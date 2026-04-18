const { formatDuration } = require('../../utils/time')

Page({
  data: {
    totalDuration: 0,
    groupDurations: [],
    weekTrend: []
  },

  onShow() {
    this.loadStatistics()
  },

  async loadStatistics() {
    const { studyRecordCollection } = require('../../utils/db')
    try {
      const { data } = await studyRecordCollection.get()
      
      let total = 0
      data.forEach((record: any) => {
        total += record.studyDuration
      })

      this.setData({
        totalDuration: total
      })
    } catch (err) {
      console.error('加载统计数据失败', err)
    }
  }
})
