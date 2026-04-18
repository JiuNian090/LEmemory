const { cardCollection, favoriteCollection, generateId } = require('../../utils/db')

Page({
  data: {
    groupId: '',
    title: '',
    currentTab: 0,
    tabs: ['学习', '目录', '卡牌', '收藏'],
    cards: [],
    favorites: [],
    currentCardIndex: 0,
    isFlipped: false,
    studyStartTime: null,
    timer: null
  },

  onLoad(options: any) {
    this.setData({
      groupId: options.groupId,
      title: options.title
    })
    wx.setNavigationBarTitle({
      title: options.title
    })
    this.loadCards()
  },

  onShow() {
    this.startStudyTimer()
  },

  onHide() {
    this.stopStudyTimer()
  },

  async loadCards() {
    try {
      const { data } = await cardCollection.where({
        groupId: this.data.groupId
      }).get()
      this.setData({
        cards: data
      })
    } catch (err) {
      console.error('加载卡牌失败', err)
    }
  },

  async loadFavorites() {
    try {
      const { data } = await favoriteCollection.where({
        groupId: this.data.groupId
      }).get()
      this.setData({
        favorites: data
      })
    } catch (err) {
      console.error('加载收藏失败', err)
    }
  },

  switchTab(e: WechatMiniprogram.TouchEvent) {
    const index = e.currentTarget.dataset.index
    this.setData({
      currentTab: index
    })
    if (index === 3) {
      this.loadFavorites()
    }
  },

  startStudyTimer() {
    this.setData({
      studyStartTime: Date.now()
    })
  },

  stopStudyTimer() {
    if (this.data.studyStartTime) {
      const duration = Math.floor((Date.now() - this.data.studyStartTime) / 1000)
      this.saveStudyRecord(duration)
    }
  },

  async saveStudyRecord(duration: number) {
    if (duration < 5) return
    const { studyRecordCollection, generateId } = require('../../utils/db')
    try {
      await studyRecordCollection.add({
        data: {
          recordId: generateId(),
          groupId: this.data.groupId,
          studyDuration: duration,
          studyDate: new Date()
        }
      })
    } catch (err) {
      console.error('保存学习记录失败', err)
    }
  },

  prevCard() {
    if (this.data.currentCardIndex > 0) {
      this.setData({
        currentCardIndex: this.data.currentCardIndex - 1
      })
    }
  },

  nextCard() {
    if (this.data.currentCardIndex < this.data.cards.length - 1) {
      this.setData({
        currentCardIndex: this.data.currentCardIndex + 1,
        isFlipped: false
      })
    }
  },

  flipCard() {
    this.setData({
      isFlipped: !this.data.isFlipped
    })
  },

  async addCard() {
    wx.showModal({
      title: '添加卡牌',
      editable: true,
      placeholderText: '正面（问题）',
      success: (res) => {
        if (res.confirm) {
          const front = res.content
          wx.showModal({
            title: '背面内容',
            editable: true,
            placeholderText: '背面（答案）',
            success: (res2) => {
              if (res2.confirm) {
                this.createCard(front, res2.content)
              }
            }
          })
        }
      }
    })
  },

  async createCard(front: string, back: string) {
    if (!front.trim() || !back.trim()) {
      wx.showToast({
        title: '内容不能为空',
        icon: 'none'
      })
      return
    }

    try {
      await cardCollection.add({
        data: {
          cardId: generateId(),
          groupId: this.data.groupId,
          front: front,
          back: back,
          createTime: new Date()
        }
      })
      wx.showToast({
        title: '添加成功',
        icon: 'success'
      })
      this.loadCards()
    } catch (err) {
      console.error('添加卡牌失败', err)
      wx.showToast({
        title: '添加失败',
        icon: 'none'
      })
    }
  },

  async toggleFavorite(card: any) {
    try {
      const { data } = await favoriteCollection.where({
        cardId: card.cardId
      }).get()
      if (data.length > 0) {
        await favoriteCollection.doc(data[0]._id).remove()
        wx.showToast({
          title: '取消收藏',
          icon: 'none'
        })
      } else {
        await favoriteCollection.add({
          data: {
            favoriteId: generateId(),
            cardId: card.cardId,
            groupId: this.data.groupId,
            createTime: new Date()
          }
        })
        wx.showToast({
          title: '收藏成功',
          icon: 'success'
        })
      }
    } catch (err) {
      console.error('操作收藏失败', err)
    }
  }
})
