const { formatDuration } = require('../../utils/time')

Page({
  data: {
    totalDuration: 0,
    formattedDuration: '0秒',
    groupCount: 0,
    cardCount: 0,
    groupDurations: [],
    weekTrend: []
  },

  onShow() {
    this.loadStatistics()
  },

  async loadStatistics() {
    const { studyRecordCollection, cardGroupCollection, cardCollection } = require('../../utils/db')
    try {
      // 加载学习记录
      const { data: records } = await studyRecordCollection.get()
      
      let total = 0
      records.forEach((record: any) => {
        total += record.studyDuration
      })

      // 加载卡牌组数量
      const { data: groups } = await cardGroupCollection.get()
      
      // 加载卡牌数量
      const { data: cards } = await cardCollection.get()

      this.setData({
        totalDuration: total,
        formattedDuration: this.formatTime(total),
        groupCount: groups.length,
        cardCount: cards.length
      })
    } catch (err) {
      console.error('加载统计数据失败', err)
    }
  },

  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`
    } else if (minutes > 0) {
      return `${minutes}分钟${secs}秒`
    } else {
      return `${secs}秒`
    }
  }
})
