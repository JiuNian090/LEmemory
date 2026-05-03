import { cardGroupCollection, cardCollection, favoriteCollection, studyRecordCollection, generateId } from '../../utils/db'
import { formatDate } from '../../utils/time'

interface CardGroupItem {
  _id?: string
  groupId: string
  userId?: string
  title: string
  description?: string
  createTime: any
  updateTime: any
  _openid?: string
  _swipeOpen?: boolean
}

interface StudyPageData {
  cardGroups: CardGroupItem[]
  isRefreshing: boolean
  showCreateDialog: boolean
  newTitle: string
  newDesc: string
  touchStartX: number
  touchStartY: number
  touchItemIndex: number
  touchMoved: boolean
}

Page<StudyPageData, WechatMiniprogram.IAnyObject, WechatMiniprogram.IAnyObject>({
  data: {
    cardGroups: [],
    isRefreshing: false,
    showCreateDialog: false,
    newTitle: '',
    newDesc: '',
    touchStartX: 0,
    touchStartY: 0,
    touchItemIndex: -1,
    touchMoved: false
  },

  onShow() {
    this.loadCardGroups()
  },

  onPullDownRefresh() {
    this.setData({ isRefreshing: true })
    this.loadCardGroups()
  },

  /**
   * 加载卡牌组列表
   */
  async loadCardGroups() {
    try {
      const { data } = await cardGroupCollection.orderBy('updateTime', 'desc').get()
      
      const formattedData = data.map((item: any) => ({
        ...item,
        updateTime: this.formatUpdateTime(item.updateTime)
      }))

      this.setData({
        cardGroups: formattedData
      })
      console.log('[StudyPage] 加载卡牌组成功', formattedData.length)
    } catch (err) {
      console.error('[StudyPage] 加载卡牌组失败', err)
      // 不显示错误提示，静默失败
    } finally {
      this.setData({ isRefreshing: false })
      wx.stopPullDownRefresh()
    }
  },

  /**
   * 格式化更新时间
   */
  formatUpdateTime(time: any): string {
    try {
      if (time instanceof Date) {
        return formatDate(time)
      } else if (typeof time === 'string') {
        return formatDate(new Date(time))
      } else if (time) {
        return formatDate(new Date())
      }
      return ''
    } catch {
      return ''
    }
  },

  /**
   * 显示创建弹窗
   */
  createCardGroup() {
    this.setData({
      showCreateDialog: true,
      newTitle: '',
      newDesc: ''
    })
  },

  /**
   * 关闭创建弹窗
   */
  closeDialog() {
    this.setData({
      showCreateDialog: false
    })
  },

  /**
   * 输入标题
   */
  onTitleInput(e: WechatMiniprogram.Input) {
    this.setData({
      newTitle: e.detail.value
    })
  },

  /**
   * 输入描述
   */
  onDescInput(e: WechatMiniprogram.Input) {
    this.setData({
      newDesc: e.detail.value
    })
  },

  /**
   * 确认创建卡牌组
   */
  confirmCreate() {
    const { newTitle, newDesc } = this.data
    
    if (!newTitle.trim()) {
      wx.showToast({
        title: '请输入标题',
        icon: 'none'
      })
      return
    }

    this.addCardGroup(newTitle, newDesc)
  },

  /**
   * 添加卡牌组到数据库
   */
  async addCardGroup(title: string, description: string) {
    try {
      wx.showLoading({ title: '创建中...' })

      await cardGroupCollection.add({
        data: {
          groupId: generateId(),
          title: title.trim(),
          description: description.trim(),
          createTime: new Date(),
          updateTime: new Date()
        }
      })

      wx.showToast({
        title: '创建成功',
        icon: 'success'
      })
      
      this.closeDialog()
      this.loadCardGroups()
    } catch (err) {
      console.error('[StudyPage] 创建卡牌组失败', err)
      wx.showToast({
        title: '创建失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 跳转到卡牌详情页
   */
  goToDetail(e: WechatMiniprogram.TouchEvent) {
    const { groupid, title } = e.currentTarget.dataset

    if (this.data.touchMoved) {
      return
    }

    const item: any = this.data.cardGroups.find(
      (g: any) => g.groupId === groupid
    )
    if (item && item._swipeOpen) {
      this.closeAllSwipes()
      return
    }

    wx.navigateTo({
      url: `/pages/cardDetail/cardDetail?groupId=${groupid}&title=${title}`
    })
  },

  onTouchStart(e: WechatMiniprogram.TouchEvent) {
    const { index } = e.currentTarget.dataset
    const touch = e.touches[0]

    this.closeAllSwipes(Number(index))

    this.setData({
      touchStartX: touch.clientX,
      touchStartY: touch.clientY,
      touchItemIndex: Number(index),
      touchMoved: false
    })
  },

  onTouchMove(e: WechatMiniprogram.TouchEvent) {
    const touch = e.touches[0]
    const deltaX = touch.clientX - this.data.touchStartX
    const deltaY = touch.clientY - this.data.touchStartY

    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      return
    }

    this.setData({ touchMoved: true })

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return
    }

    if (deltaX < -30) {
      const idx = this.data.touchItemIndex
      if (idx >= 0) {
        this.setData({
          [`cardGroups[${idx}]._swipeOpen`]: true
        })
      }
    }
  },

  onTouchEnd() {
    // swipe 状态由 move 中的阈值触发，这里仅做清理
  },

  onLongPressDelete(e: WechatMiniprogram.TouchEvent) {
    const { groupid, title } = e.currentTarget.dataset

    wx.showModal({
      title: '删除卡牌组',
      content: `确定要删除「${title}」吗？组内所有卡牌和收藏也会被删除，且无法恢复。`,
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.doDeleteGroup(groupid)
        }
      }
    })
  },

  onDeleteGroup(e: WechatMiniprogram.TouchEvent) {
    const { groupid, title } = e.currentTarget.dataset

    wx.showModal({
      title: '删除卡牌组',
      content: `确定要删除「${title}」吗？组内所有卡牌和收藏也会被删除，且无法恢复。`,
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.doDeleteGroup(groupid)
        }
      }
    })
  },

  closeAllSwipes(except?: WechatMiniprogram.TouchEvent | number) {
    const exceptIndex = typeof except === 'number' ? except : -1
    this.data.cardGroups.forEach((item, i) => {
      if (item._swipeOpen && i !== exceptIndex) {
        this.setData({
          [`cardGroups[${i}]._swipeOpen`]: false
        })
      }
    })
  },

  async doDeleteGroup(groupId: string) {
    try {
      wx.showLoading({ title: '删除中...' })

      const cardRes = await cardCollection.where({ groupId }).get()
      for (const card of cardRes.data as any[]) {
        if (card._id) {
          await cardCollection.doc(card._id).remove()
        }
      }

      const favRes = await favoriteCollection.where({ groupId }).get()
      for (const fav of favRes.data as any[]) {
        if (fav._id) {
          await favoriteCollection.doc(fav._id).remove()
        }
      }

      const studyRes = await studyRecordCollection.where({ groupId }).get()
      for (const record of studyRes.data as any[]) {
        if (record._id) {
          await studyRecordCollection.doc(record._id).remove()
        }
      }

      const group = this.data.cardGroups.find(g => g.groupId === groupId)
      if (group && group._id) {
        await cardGroupCollection.doc(group._id).remove()
      }

      wx.showToast({
        title: '删除成功',
        icon: 'success'
      })

      this.loadCardGroups()
      console.log('[StudyPage] 删除卡牌组成功', groupId)
    } catch (err) {
      console.error('[StudyPage] 删除卡牌组失败', err)
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation() {
    // 防止点击弹窗内容时关闭弹窗
  }
})
