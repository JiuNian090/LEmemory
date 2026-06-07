import { studyRecordCollection, cardGroupCollection, cardCollection } from '../../utils/db'
import { formatDuration } from '../../utils/time'

interface GroupDuration {
  groupId: string
  title: string
  duration: number
}

interface WeekTrend {
  date: string
  duration: number
}

interface StatisticsPageData {
  totalDuration: number
  formattedDuration: string
  groupCount: number
  cardCount: number
  groupDurations: GroupDuration[]
  weekTrend: WeekTrend[]
  maxDuration: number
  maxGroupDuration: number
}

Page<StatisticsPageData, WechatMiniprogram.IAnyObject>({
  data: {
    totalDuration: 0,
    formattedDuration: '0秒',
    groupCount: 0,
    cardCount: 0,
    groupDurations: [],
    weekTrend: [],
    maxDuration: 0,
    maxGroupDuration: 0
  },

  onShow() {
    this.loadStatistics()
  },

  /**
   * 加载统计数据
   */
  async loadStatistics() {
    try {
      wx.showLoading({ title: '加载中...' })

      // 并行加载数据，提升性能
      const [
        { data: records },
        { data: groups },
        { data: cards }
      ] = await Promise.all([
        studyRecordCollection.get(),
        cardGroupCollection.get(),
        cardCollection.get()
      ])

      // 处理学习记录
      const { total, groupMap, dateMap } = this.processStudyRecords(records)

      // 生成卡牌组时长数据
      const groupDurations = this.generateGroupDurations(groups, groupMap)

      // 生成最近7天趋势数据
      const weekTrend = this.generateWeekTrend(dateMap)

      // 计算最大时长
      const maxDuration = weekTrend.length > 0 ? Math.max(...weekTrend.map((t: WeekTrend) => t.duration)) : 0
      const maxGroupDuration = groupDurations.length > 0 ? Math.max(...groupDurations.map((g: GroupDuration) => g.duration)) : 0

      this.setData({
        totalDuration: total,
        formattedDuration: formatDuration(total),
        groupCount: groups.length,
        cardCount: cards.length,
        groupDurations: groupDurations,
        weekTrend: weekTrend,
        maxDuration: maxDuration,
        maxGroupDuration: maxGroupDuration
      })

    } catch (err) {
      console.error('[StatisticsPage] 加载统计数据失败', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 处理学习记录
   */
  processStudyRecords(records: any[]): { total: number; groupMap: Map<string, number>; dateMap: Map<string, number> } {
    let total = 0
    const groupMap = new Map<string, number>()
    const dateMap = new Map<string, number>()

    records.forEach((record: any) => {
      total += record.studyDuration || 0

      const groupId = record.groupId
      if (groupId) {
        const current = groupMap.get(groupId) || 0
        groupMap.set(groupId, current + (record.studyDuration || 0))
      }

      const studyDate = this.parseDateSafely(record.studyDate)
      const dateStr = this.formatDate(studyDate)
      const currentDate = dateMap.get(dateStr) || 0
      dateMap.set(dateStr, currentDate + (record.studyDuration || 0))
    })

    return { total, groupMap, dateMap }
  },

  /**
   * 生成卡牌组时长数据
   */
  generateGroupDurations(groups: any[], groupMap: Map<string, number>): GroupDuration[] {
    return groups
      .map((group: any) => ({
        groupId: group.groupId,
        title: group.title,
        duration: groupMap.get(group.groupId) || 0
      }))
      .filter((item: GroupDuration) => item.duration > 0)
      .sort((a, b) => b.duration - a.duration)
  },

  /**
   * 生成最近7天趋势数据
   */
  generateWeekTrend(dateMap: Map<string, number>): WeekTrend[] {
    const weekTrend: WeekTrend[] = []
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      const dateStr = this.formatDate(date)
      weekTrend.push({
        date: this.formatDateShort(date),
        duration: dateMap.get(dateStr) || 0
      })
    }
    return weekTrend
  },

  /**
   * 安全解析日期（兼容多种格式）
   */
  parseDateSafely(dateValue: any): Date {
    if (!dateValue) return new Date()
    
    if (dateValue instanceof Date) return dateValue
    
    if (typeof dateValue === 'string') {
      const normalizedDate = dateValue.replace(/-/g, '/').replace('T', ' ')
      const parsed = new Date(normalizedDate)
      if (!isNaN(parsed.getTime())) return parsed
    }
    
    if (typeof dateValue === 'number') {
      return new Date(dateValue)
    }
    
    return new Date()
  },

  /**
   * 格式化日期（用于比较）
   */
  formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  /**
   * 格式化日期（用于显示）
   */
  formatDateShort(date: Date): string {
    const month = (date.getMonth() + 1)
    const day = date.getDate()
    return `${month}/${day}`
  },

  /**
   * 格式化时长（用于模板显示）
   */
  formatDuration(seconds: number): string {
    return formatDuration(seconds)
  }
})
