/**
 * 本地统计计算工具
 * 替代原来的 statistics_get 云函数，从本地存储读取数据计算统计结果
 */
import { getLocalStorageData, getDailyStudyMap } from './db'
import type { StudyRecord, CardGroup, Card, StatisticsResult, PeriodType } from './types'

const DAY_MS = 86400000
const DEFAULT_DAILY_GOAL = 30
const STORAGE_KEYS = {
  CARD_GROUPS: 'card_groups',
  CARDS: 'cards',
  STUDY_RECORDS: 'study_records'
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateStr(s: string): Date {
  const parts = s.split('-').map(Number)
  return new Date(parts[0], parts[1] - 1, parts[2])
}

function enumerateMonths(start: Date, end: Date): string[] {
  const months: string[] = []
  const cur = new Date(start.getFullYear(), start.getMonth(), 1)
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cur.getTime() <= endMonth.getTime()) {
    const key = `${cur.getFullYear()}-${(cur.getMonth() + 1).toString().padStart(2, '0')}`
    months.push(key)
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
}

function calculateChange(current: number, previous: number): { percent: number; text: string; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0 && current === 0) return { percent: 0, text: '—', direction: 'flat' }
  if (previous === 0) return { percent: 100, text: '↑ 100%', direction: 'up' }
  const diff = ((current - previous) / previous) * 100
  const rounded = Math.round(diff * 10) / 10
  if (rounded === 0) return { percent: 0, text: '—', direction: 'flat' }
  return {
    percent: rounded,
    text: `${rounded > 0 ? '↑' : '↓'} ${Math.abs(rounded)}%`,
    direction: rounded > 0 ? 'up' : 'down'
  }
}

function calculateStreak(dateSet: Set<string>, today: Date): number {
  let streak = 0
  const cur = new Date(today)
  for (let i = 0; i < 365; i++) {
    if (dateSet.has(toDateStr(cur))) {
      streak++
      cur.setDate(cur.getDate() - 1)
    } else if (i === 0) {
      cur.setDate(cur.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

function calculateLongestStreak(dateSet: Set<string>): number {
  if (dateSet.size === 0) return 0
  const sorted = Array.from(dateSet).sort()
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

function getHeatmapLevel(value: number, dailyGoalSeconds: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (value === 0) return 0
  if (dailyGoalSeconds <= 0) return 0
  const ratio = value / dailyGoalSeconds
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  if (ratio < 1) return 4
  return 5
}

function buildResult(
  records: StudyRecord[],
  prevRecords: StudyRecord[],
  groups: CardGroup[],
  cards: Card[],
  start: Date,
  end: Date,
  periodType: string,
  dailyGoalMinutes: number
): StatisticsResult {
  let totalDuration = 0
  const dailyMap = new Map<string, number>()
  const monthMap = new Map<string, number>()
  const groupMap = new Map<string, number>()
  const dateSet = new Set<string>()

  records.forEach(r => {
    const dur = r.studyDuration || 0
    const date = r.studyDate instanceof Date ? r.studyDate : new Date(r.studyDate)
    const dStr = toDateStr(date)
    const mKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`

    totalDuration += dur
    dailyMap.set(dStr, (dailyMap.get(dStr) || 0) + dur)
    monthMap.set(mKey, (monthMap.get(mKey) || 0) + dur)
    dateSet.add(dStr)
    if (r.groupId) {
      groupMap.set(r.groupId, (groupMap.get(r.groupId) || 0) + dur)
    }
  })

  let prevDuration = 0
  prevRecords.forEach(r => { prevDuration += r.studyDuration || 0 })

  const change = calculateChange(totalDuration, prevDuration)

  const allDays: string[] = []
  const cur = new Date(start)
  const endDate = new Date(end)
  while (cur.getTime() <= endDate.getTime()) {
    allDays.push(toDateStr(cur))
    cur.setDate(cur.getDate() + 1)
  }

  const trendData = allDays.map(d => {
    const date = parseDateStr(d)
    return {
      date: d,
      duration: dailyMap.get(d) || 0,
      label: `${date.getMonth() + 1}/${date.getDate()}`
    }
  })

  const months = enumerateMonths(start, end)
  const monthlyData = months.map(m => ({
    month: m,
    duration: monthMap.get(m) || 0
  }))

  const year = start.getFullYear()
  const heatmapData = []
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)
  const cur2 = new Date(yearStart)
  while (cur2.getTime() <= yearEnd.getTime()) {
    const dStr = toDateStr(cur2)
    const value = dailyMap.get(dStr) || 0
    heatmapData.push({
      date: dStr,
      value,
      level: getHeatmapLevel(value, dailyGoalMinutes * 60)
    })
    cur2.setDate(cur2.getDate() + 1)
  }

  const groupTitleMap: Record<string, string> = {}
  groups.forEach(g => { groupTitleMap[g.groupId] = g.title })

  const groupPieData = Array.from(groupMap.entries())
    .map(([groupId, value]) => ({
      groupId,
      title: groupTitleMap[groupId] || '已删除卡牌组',
      value,
      percentage: 0,
      color: ''
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7)
  if (totalDuration > 0) {
    groupPieData.forEach(s => { s.percentage = (s.value / totalDuration) * 100 })
  }

  const goalSeconds = dailyGoalMinutes * 60
  // 筛选出达到当日目标的日期（"打卡成功"的日期）
  const qualifiedDateSet = new Set<string>()
  dateSet.forEach(d => {
    if ((dailyMap.get(d) || 0) >= goalSeconds) {
      qualifiedDateSet.add(d)
    }
  })

  // 连续打卡/最长连续使用"达标日期"计算
  const qualifiedStreak = calculateStreak(qualifiedDateSet, new Date())
  const qualifiedLongest = calculateLongestStreak(qualifiedDateSet)

  const achievedDays = qualifiedDateSet.size
  const achievementRate = dateSet.size > 0
    ? Math.round((achievedDays / dateSet.size) * 100)
    : 0

  return {
    totalDuration,
    studyDays: qualifiedDateSet.size,
    cardCount: cards.length,
    groupCount: groups.length,
    previousDuration: prevDuration,
    changePercent: change.percent,
    changeText: change.text,
    changeDirection: change.direction,
    dailyGoalMinutes,
    achievedDays,
    achievementRate,
    currentStreak: qualifiedStreak,
    longestStreak: qualifiedLongest,
    trendData,
    monthlyData,
    heatmapData,
    groupPieData,
    startDate: toDateStr(start),
    endDate: toDateStr(end),
    periodType: periodType as PeriodType
  }
}

/**
 * 从本地存储或云端数据计算统计结果
 * @param cloudRecords - 可选，云端学习记录，未提供时从本地存储读取
 */
export function computeStatistics(
  startDate: string,
  endDate: string,
  periodType: string = 'custom',
  dailyGoalMinutes: number = DEFAULT_DAILY_GOAL,
  cloudRecords?: StudyRecord[]
): StatisticsResult {
  const start = parseDateStr(startDate)
  const end = parseDateStr(endDate)
  end.setHours(23, 59, 59, 999)
  start.setHours(0, 0, 0, 0)

  const lengthMs = end.getTime() - start.getTime()
  const prevEnd = new Date(start.getTime() - 1)
  prevEnd.setHours(23, 59, 59, 999)
  const prevStart = new Date(start.getTime() - lengthMs)
  prevStart.setHours(0, 0, 0, 0)

  const allRecords = cloudRecords ?? (() => {
    const localRecords = getLocalStorageData(STORAGE_KEYS.STUDY_RECORDS) as StudyRecord[]

    // 若 study_records 为空，从 study_daily 重建（兼容旧数据+离线场景）
    if (localRecords.length === 0) {
      const dailyMap = getDailyStudyMap()
      const rebuilt: StudyRecord[] = []
      for (const [dateStr, entry] of Object.entries(dailyMap)) {
        for (const [groupId, duration] of Object.entries(entry.groups)) {
          rebuilt.push({
            recordId: '',
            userId: 'local',
            groupId,
            studyDuration: duration,
            studyDate: new Date(dateStr + 'T00:00:00'),
            updateTime: 0
          })
        }
      }
      return rebuilt
    }

    return localRecords
  })()

  const records = allRecords.filter(r => {
    const d = r.studyDate instanceof Date ? r.studyDate : new Date(r.studyDate)
    return d.getTime() >= start.getTime() && d.getTime() <= end.getTime()
  })

  const prevRecords = allRecords.filter(r => {
    const d = r.studyDate instanceof Date ? r.studyDate : new Date(r.studyDate)
    return d.getTime() >= prevStart.getTime() && d.getTime() <= prevEnd.getTime()
  })

  const groups = getLocalStorageData(STORAGE_KEYS.CARD_GROUPS) as CardGroup[]
  const cards = getLocalStorageData(STORAGE_KEYS.CARDS) as Card[]

  return buildResult(records, prevRecords, groups, cards, start, end, periodType, dailyGoalMinutes)
}
