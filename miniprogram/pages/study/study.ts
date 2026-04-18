const { cardGroupCollection, generateId } = require('../../utils/db')

Page({
  data: {
    cardGroups: []
  },

  onShow() {
    this.loadCardGroups()
  },

  async loadCardGroups() {
    try {
      const { data } = await cardGroupCollection.orderBy('updateTime', 'desc').get()
      this.setData({
        cardGroups: data
      })
    } catch (err) {
      console.error('加载卡牌组失败', err)
    }
  },

  createCardGroup() {
    wx.showModal({
      title: '创建卡牌组',
      editable: true,
      placeholderText: '请输入标题',
      success: (res) => {
        if (res.confirm) {
          this.addCardGroup(res.content)
        }
      }
    })
  },

  async addCardGroup(title: string) {
    if (!title.trim()) {
      wx.showToast({
        title: '请输入标题',
        icon: 'none'
      })
      return
    }

    try {
      await cardGroupCollection.add({
        data: {
          groupId: generateId(),
          title: title,
          description: '',
          createTime: new Date(),
          updateTime: new Date()
        }
      })
      wx.showToast({
        title: '创建成功',
        icon: 'success'
      })
      this.loadCardGroups()
    } catch (err) {
      console.error('创建卡牌组失败', err)
      wx.showToast({
        title: '创建失败',
        icon: 'none'
      })
    }
  },

  goToDetail(e: WechatMiniprogram.TouchEvent) {
    const { groupid, title } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/cardDetail/cardDetail?groupId=${groupid}&title=${title}`
    })
  }
})
