const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const DAY_MS = 86400000
const DEFAULT_DAILY_GOAL = 30
const MAX_RECORDS = 1000

function toDateStr(d) {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateStr(s) {
  const parts = s.split('-').map(Number)
  return new Date(parts[0], parts[1] - 1, parts[2])
}

function enumerateMonths(start, end) {
  const months = []
  const cur = new Date(start.getFullYear(), start.getMonth(), 1)
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cur.getTime() <= endMonth.getTime()) {
    const key = `${cur.getFullYear()}-${(cur.getMonth() + 1).toString().padStart(2, '0')}`
    months.push(key)
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
}

function calculateChange(current, previous) {
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

function calculateStreak(dateSet, today) {
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

function calculateLongestStreak(dateSet) {
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

function getHeatmapLevel(value, maxValue) {
  if (value === 0) return 0
  if (maxValue === 0) return 0
  const ratio = value / maxValue
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  return 4
}

function buildResult(records, prevRecords, groups, cards, start, end, periodType, dailyGoalMinutes) {
  // 基础聚合
  let totalDuration = 0
  const dailyMap = new Map()
  const monthMap = new Map()
  const groupMap = new Map()
  const dateSet = new Set()

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

  // 上期时长
  let prevDuration = 0
  prevRecords.forEach(r => { prevDuration += r.studyDuration || 0 })

  const change = calculateChange(totalDuration, prevDuration)

  // 趋势数据
  const allDays = []
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

  // 月度数据
  const months = enumerateMonths(start, end)
  const monthlyData = months.map(m => ({
    month: m,
    duration: monthMap.get(m) || 0
  }))

  // 热力图：取 start 所在年
  const year = start.getFullYear()
  const heatmapData = []
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)
  const cur2 = new Date(yearStart)
  const maxDaily = Math.max(...Array.from(dailyMap.values()), 1)
  while (cur2.getTime() <= yearEnd.getTime()) {
    const dStr = toDateStr(cur2)
    const value = dailyMap.get(dStr) || 0
    heatmapData.push({
      date: dStr,
      value,
      level: getHeatmapLevel(value, maxDaily)
    })
    cur2.setDate(cur2.getDate() + 1)
  }

  // 卡牌组饼图
  const groupTitleMap = {}
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

  // 连续打卡
  const currentStreak = calculateStreak(dateSet, new Date())
  const longestStreak = calculateLongestStreak(dateSet)

  // 目标达成
  const goalSeconds = dailyGoalMinutes * 60
  let achievedDays = 0
  dateSet.forEach(d => {
    if ((dailyMap.get(d) || 0) >= goalSeconds) achievedDays++
  })
  const achievementRate = dateSet.size > 0
    ? Math.round((achievedDays / dateSet.size) * 100)
    : 0

  return {
    totalDuration,
    studyDays: dateSet.size,
    cardCount: cards.length,
    groupCount: groups.length,
    previousDuration: prevDuration,
    changePercent: change.percent,
    changeText: change.text,
    changeDirection: change.direction,
    dailyGoalMinutes,
    achievedDays,
    achievementRate,
    currentStreak,
    longestStreak,
    trendData,
    monthlyData,
    heatmapData,
    groupPieData,
    startDate: toDateStr(start),
    endDate: toDateStr(end),
    periodType
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const OPENID = wxContext.OPENID

  try {
    const {
      startDate,
      endDate,
      periodType = 'custom',
      dailyGoalMinutes = DEFAULT_DAILY_GOAL
    } = event

    if (!startDate || !endDate) {
      return { success: false, error: 'startDate 和 endDate 必填' }
    }

    const start = parseDateStr(startDate)
    const end = parseDateStr(endDate)
    end.setHours(23, 59, 59, 999)
    start.setHours(0, 0, 0, 0)

    // 上期范围
    const lengthMs = end.getTime() - start.getTime()
    const prevEnd = new Date(start.getTime() - 1)
    prevEnd.setHours(23, 59, 59, 999)
    const prevStart = new Date(start.getTime() - lengthMs)
    prevStart.setHours(0, 0, 0, 0)

    // 查询范围内记录
    const { data: records } = await db.collection('studyRecords')
      .where({
        _openid: OPENID,
        studyDate: _.and(_.gte(start), _.lte(end))
      })
      .limit(MAX_RECORDS)
      .get()

    // 查询上期记录
    const { data: prevRecords } = await db.collection('studyRecords')
      .where({
        _openid: OPENID,
        studyDate: _.and(_.gte(prevStart), _.lte(prevEnd))
      })
      .limit(MAX_RECORDS)
      .get()

    // 查询卡牌组与卡牌
    const [groupsRes, cardsRes] = await Promise.all([
      db.collection('cardGroups').where({ _openid: OPENID }).get(),
      db.collection('cards').where({ _openid: OPENID }).get()
    ])

    const result = buildResult(
      records,
      prevRecords,
      groupsRes.data,
      cardsRes.data,
      start,
      end,
      periodType,
      dailyGoalMinutes
    )

    return { success: true, data: result }
  } catch (err) {
    console.error('[statistics_get]', err)
    return { success: false, error: err.message || err }
  }
}
