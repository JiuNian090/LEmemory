/**
 * 间隔重复调度（SRS）—— 简化的 SM-2 实现
 *
 * 设计依据：docs/specs/2026-09-11-srs-review-scheduling-design.md
 * 本模块为纯函数模块，不依赖 wx API，便于静态验证与复用。
 */
import type { Card, MasteryStatus, SrsState } from './types'
import { formatDate, parseDate } from './time'

/** SRS 相关的用户设置 */
export interface SrsSettings {
  /** 每日新卡上限 */
  dailyNewCards: number
  /** 每日复习上限 */
  dailyReviewLimit: number
}

export const DEFAULT_SRS_SETTINGS: SrsSettings = Object.freeze({
  dailyNewCards: 10,
  dailyReviewLimit: 50
})

/** ease 允许范围 */
const MIN_EASE = 1.3
const MAX_EASE = 2.8
const INITIAL_EASE = 2.5

/** 各档掌握度对 ease 的扣减 */
const EASE_PENALTY: Record<MasteryStatus, number> = {
  new: 0.2,
  difficult: 0.15,
  learning: 0.05,
  mastered: 0
}

/** 首次复习（interval 为 0）时的初始间隔（天） */
const FIRST_INTERVAL: Record<MasteryStatus, number> = {
  new: 1,
  difficult: 1,
  learning: 1,
  mastered: 3
}

/** 标记为「基本掌握」时的间隔增长率 */
const HARD_INTERVAL_GROWTH = 1.2

/** 判定为遗忘的掌握度（计入 lapses，并在当轮重练） */
const FAILED_STATUSES: MasteryStatus[] = ['new', 'difficult']

/** 当前本地日期键 'YYYY-MM-DD' */
export function todayKey(): string {
  return formatDate(new Date())
}

/** 该掌握度是否判定为遗忘 */
export function isFailed(status: MasteryStatus): boolean {
  return FAILED_STATUSES.includes(status)
}

/** 卡片今天是否到期需要复习 */
export function isDue(card: Readonly<Card>, today: string): boolean {
  const nextReviewDate = card.srs && card.srs.nextReviewDate
  if (!nextReviewDate) return false
  // 'YYYY-MM-DD' 的字典序与时间序一致
  return nextReviewDate <= today
}

/** 是否为新卡（从未复习过） */
export function isFresh(card: Readonly<Card>): boolean {
  return !card.srs
}

/**
 * 根据用户标记的掌握度计算新的 SRS 状态（不可变：返回新对象）
 */
export function applyMastery(card: Readonly<{ srs?: SrsState }>, status: MasteryStatus, today: string): SrsState {
  const normalized = normalizeStatus(status)
  const prev = card.srs
  const prevInterval = toFiniteNumber(prev && prev.interval, 0)
  const prevEase = toFiniteNumber(prev && prev.ease, INITIAL_EASE)
  const prevLapses = toFiniteNumber(prev && prev.lapses, 0)

  const interval = nextInterval(normalized, prevInterval, prevEase)

  return {
    interval,
    ease: clampEase(prevEase - EASE_PENALTY[normalized]),
    lapses: prevLapses + (isFailed(normalized) ? 1 : 0),
    lastReviewDate: today,
    nextReviewDate: addDays(today, interval)
  }
}

/** 兜底：未知掌握度按「未掌握」处理，避免算出 NaN */
function normalizeStatus(status: MasteryStatus): MasteryStatus {
  return Object.prototype.hasOwnProperty.call(EASE_PENALTY, status) ? status : 'new'
}

/** 兜底：残缺旧数据（srs 存在但字段缺失/非法）不参与运算，回落默认值 */
function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** 计算下次复习间隔（天） */
function nextInterval(status: MasteryStatus, prevInterval: number, prevEase: number): number {
  if (prevInterval <= 0) {
    return FIRST_INTERVAL[status]
  }
  if (status === 'mastered') {
    return Math.max(1, Math.round(prevInterval * prevEase))
  }
  if (status === 'learning') {
    return Math.max(1, Math.round(prevInterval * HARD_INTERVAL_GROWTH))
  }
  return FIRST_INTERVAL[status]
}

/** 夹紧 ease 到 [MIN_EASE, MAX_EASE]，保留两位小数 */
function clampEase(ease: number): number {
  const clamped = Math.min(MAX_EASE, Math.max(MIN_EASE, ease))
  return Math.round(clamped * 100) / 100
}

/** 日期键加天数 */
function addDays(dateKey: string, days: number): string {
  const base = parseDate(dateKey)
  if (!base) return dateKey
  const next = new Date(base.getTime())
  next.setDate(next.getDate() + days)
  return formatDate(next)
}

/** 取出今天到期的卡片：越早到期越靠前，再按上限截断 */
export function pickDueCards(cards: readonly Card[], limit: number, today: string): Card[] {
  return cards
    .filter(card => isDue(card, today))
    .slice()
    .sort((a, b) => compareNextReviewDate(a, b))
    .slice(0, normalizeLimit(limit))
}

/** 取出尚未学习过的新卡：按创建时间升序，再按上限截断 */
export function pickNewCards(cards: readonly Card[], limit: number): Card[] {
  return cards
    .filter(card => isFresh(card))
    .slice()
    .sort((a, b) => compareCreateTime(a, b))
    .slice(0, normalizeLimit(limit))
}

export interface ReviewQueue {
  /** 到期待复习的卡片 */
  due: Card[]
  /** 新卡 */
  fresh: Card[]
  /** 队列总长度 */
  total: number
}

/** 构建今日学习队列：到期复习卡 + 新卡 */
export function buildReviewQueue(cards: readonly Card[], settings: SrsSettings, today: string): ReviewQueue {
  const due = pickDueCards(cards, settings.dailyReviewLimit, today)
  const fresh = pickNewCards(cards, settings.dailyNewCards)
  return { due, fresh, total: due.length + fresh.length }
}

function compareNextReviewDate(a: Readonly<Card>, b: Readonly<Card>): number {
  const av = (a.srs && a.srs.nextReviewDate) || ''
  const bv = (b.srs && b.srs.nextReviewDate) || ''
  if (av < bv) return -1
  if (av > bv) return 1
  return 0
}

function compareCreateTime(a: Readonly<Card>, b: Readonly<Card>): number {
  const parsedA = parseDate(a.createTime)
  const parsedB = parseDate(b.createTime)
  return (parsedA ? parsedA.getTime() : 0) - (parsedB ? parsedB.getTime() : 0)
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit < 0) return 0
  return Math.floor(limit)
}
