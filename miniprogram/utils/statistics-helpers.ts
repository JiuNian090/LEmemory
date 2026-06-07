// 统计相关的纯函数工具
import type { PeriodType } from './types'

const DAY_MS = 86400000

/**
 * 格式化日期为 'YYYY-MM-DD'
 */
export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 解析 'YYYY-MM-DD' 为 Date（本地时间 00:00:00）
 */
export function parseDateStr(s: string): Date {
  const parts = s.split('-').map(Number)
  return new Date(parts[0], parts[1] - 1, parts[2])
}

/**
 * 获取快捷时间范围的起止日期
 */
export function getPeriodRange(periodType: PeriodType, today: Date = new Date()): { start: string; end: string } {
  const end = toDateStr(today)

  switch (periodType) {
    case 'week': {
      const start = new Date(today)
      const day = start.getDay()
      const diff = day === 0 ? 6 : day - 1
      start.setDate(today.getDate() - diff)
      return { start: toDateStr(start), end }
    }
    case 'month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: toDateStr(start), end }
    }
    case 'year': {
      const start = new Date(today.getFullYear(), 0, 1)
      return { start: toDateStr(start), end }
    }
    case 'all':
    case 'custom':
    default:
      // 'all' 和 'custom' 由调用方传入起止，这里返回仅当天
      return { start: end, end }
  }
}

/**
 * 计算上一周期（同长度）的起止日期
 */
export function getPreviousPeriodRange(start: string, end: string): { start: string; end: string } {
  const startDate = parseDateStr(start)
  const endDate = parseDateStr(end)
  const lengthMs = endDate.getTime() - startDate.getTime() + DAY_MS
  const prevEnd = new Date(startDate.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - lengthMs + 1)
  return { start: toDateStr(prevStart), end: toDateStr(prevEnd) }
}

/**
 * 生成日期范围内的所有日期（包含首尾）
 */
export function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = parseDateStr(start)
  const endDate = parseDateStr(end)
  while (cur.getTime() <= endDate.getTime()) {
    dates.push(toDateStr(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export interface ChangeResult {
  percent: number
  text: string
  direction: 'up' | 'down' | 'flat'
}

/**
 * 计算变化百分比与展示文本
 */
export function calculateChange(current: number, previous: number): ChangeResult {
  if (previous === 0 && current === 0) {
    return { percent: 0, text: '—', direction: 'flat' }
  }
  if (previous === 0) {
    return { percent: 100, text: '↑ 100%', direction: 'up' }
  }
  const diff = ((current - previous) / previous) * 100
  const rounded = Math.round(diff * 10) / 10
  if (rounded === 0) return { percent: 0, text: '—', direction: 'flat' }
  const arrow = rounded > 0 ? '↑' : '↓'
  return {
    percent: rounded,
    text: `${arrow} ${Math.abs(rounded)}%`,
    direction: rounded > 0 ? 'up' : 'down'
  }
}

/**
 * 计算连续打卡天数（从今天向前；允许今天未打卡）
 */
export function calculateCurrentStreak(studyDateSet: Set<string>, today: Date = new Date()): number {
  let streak = 0
  const cur = new Date(today)
  for (let i = 0; i < 365; i++) {
    if (studyDateSet.has(toDateStr(cur))) {
      streak++
      cur.setDate(cur.getDate() - 1)
    } else if (i === 0) {
      // 今天未打卡，从昨天开始算
      cur.setDate(cur.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

/**
 * 计算范围内最长连续打卡
 */
export function calculateLongestStreak(studyDateSet: Set<string>): number {
  if (studyDateSet.size === 0) return 0
  const sorted = Array.from(studyDateSet).sort()
  let longest = 1
  let current = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseDateStr(sorted[i - 1]).getTime()
    const cur = parseDateStr(sorted[i]).getTime()
    if (cur - prev === DAY_MS) {
      current++
      longest = Math.max(longest, current)
    } else {
      current = 1
    }
  }
  return longest
}

/**
 * 计算目标达成率（0-100）
 */
export function calculateAchievementRate(
  studyDateSet: Set<string>,
  dailyGoalMinutes: number,
  dailyDurations: Map<string, number>
): { achievedDays: number; rate: number } {
  if (studyDateSet.size === 0 || dailyGoalMinutes <= 0) {
    return { achievedDays: 0, rate: 0 }
  }
  const goalSeconds = dailyGoalMinutes * 60
  let achieved = 0
  studyDateSet.forEach(date => {
    if ((dailyDurations.get(date) || 0) >= goalSeconds) {
      achieved++
    }
  })
  const rate = Math.round((achieved / studyDateSet.size) * 100)
  return { achievedDays: achieved, rate }
}

/**
 * 简化时长显示：>= 1小时显示 "1.2h"，< 1小时显示 "25m"
 */
export function formatDurationShort(seconds: number): string {
  if (seconds <= 0) return '0m'
  const hours = seconds / 3600
  if (hours >= 1) return `${hours.toFixed(1)}h`
  const minutes = Math.floor(seconds / 60)
  if (minutes > 0) return `${minutes}m`
  return `${Math.floor(seconds)}s`
}

/**
 * 工具函数：把 StudyRecord[] 转换为每日总秒数 Map
 */
export function buildDailyDurationMap(records: Array<{ studyDuration: number; studyDate: any }>): Map<string, number> {
  const map = new Map<string, number>()
  records.forEach(r => {
    const date = r.studyDate instanceof Date ? r.studyDate : new Date(r.studyDate)
    const key = toDateStr(date)
    map.set(key, (map.get(key) || 0) + (r.studyDuration || 0))
  })
  return map
}
