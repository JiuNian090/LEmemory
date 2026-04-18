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

Page<StatisticsPageData, WechatMiniprogram.IAnyObject, WechatMiniprogram.IAnyObject>({
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

      // 加载学习记录
      const { data: records } = await studyRecordCollection.get()

      let total = 0
      const groupMap: Map<string, number> = new Map()
      const dateMap: Map<string, number> = new Map()

      records.forEach((record: any) => {
        total += record.studyDuration

        // 按卡牌组统计
        const groupId = record.groupId
        if (groupId) {
          const current = groupMap.get(groupId) || 0
          groupMap.set(groupId, current + record.studyDuration)
        }

        // 按日期统计（最近7天）
        const studyDate = new Date(record.studyDate)
        const dateStr = this.formatDate(studyDate)
        const currentDate = dateMap.get(dateStr) || 0
        dateMap.set(dateStr, currentDate + record.studyDuration)
      })

      // 加载卡牌组数据
      const { data: groups } = await cardGroupCollection.get()

      // 加载卡牌数据
      const { data: cards } = await cardCollection.get()

      // 生成卡牌组时长数据
      const groupDurations: GroupDuration[] = []
      groups.forEach((group: any) => {
        const duration = groupMap.get(group.groupId) || 0
        if (duration > 0) {
          groupDurations.push({
            groupId: group.groupId,
            title: group.title,
            duration: duration
          })
        }
      })

      // 按时长降序排序
      groupDurations.sort((a, b) => b.duration - a.duration)

      // 生成最近7天趋势数据
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

      // 计算最大时长
      const maxDuration = weekTrend.length > 0 ? Math.max(...weekTrend.map(t => t.duration)) : 0
      const maxGroupDuration = groupDurations.length > 0 ? Math.max(...groupDurations.map(g => g.duration)) : 0

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
