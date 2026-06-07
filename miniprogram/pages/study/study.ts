import { cardGroupCollection, generateId, deleteCardGroup } from '../../utils/db'
import { formatDate } from '../../utils/time'
import { showErrorToast } from '../../utils/error'

interface CardGroupItem {
  _id?: string
  groupId: string
  userId?: string
  title: string
  description?: string
  createTime: any
  updateTime: any
  _openid?: string
}

interface StudyPageData {
  cardGroups: CardGroupItem[]
  isRefreshing: boolean
  showCreateDialog: boolean
  newTitle: string
  newDesc: string
  deleteGroupId: string
  deleteGroupTitle: string
  swipeIndex: number
  startX: number
}

Page<StudyPageData, WechatMiniprogram.IAnyObject>({
  data: {
    cardGroups: [],
    isRefreshing: false,
    showCreateDialog: false,
    newTitle: '',
    newDesc: '',
    deleteGroupId: '',
    deleteGroupTitle: '',
    swipeIndex: -1,
    startX: 0
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
    } catch (err: any) {
      console.error('[StudyPage] 创建卡牌组失败', err)
      showErrorToast(err)
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 跳转到卡牌详情页
   */
  goToDetail(e: WechatMiniprogram.TouchEvent) {
    const { groupid, title } = e.currentTarget.dataset

    wx.navigateTo({
      url: `/pages/cardDetail/cardDetail?groupId=${groupid}&title=${encodeURIComponent(title || '')}`
    })
  },

  stopPropagation() {
    // 防止点击弹窗内容时关闭弹窗
  },

  /**
   * 触摸开始 - 记录起始位置
   */
  handleTouchStart(e: WechatMiniprogram.TouchEvent) {
    const index = e.currentTarget.dataset.index
    if (index === undefined || index === null) return
    this.setData({
      startX: e.touches[0].clientX,
      swipeIndex: this.data.swipeIndex === index ? index : this.data.swipeIndex
    })
  },

  /**
   * 触摸移动 - 实时判断滑动
   */
  handleTouchMove(e: WechatMiniprogram.TouchEvent) {
    const index = e.currentTarget.dataset.index
    if (index === undefined || index === null) return

    const currentX = e.touches[0].clientX
    const diff = this.data.startX - currentX

    // 左滑超过阈值 → 展开删除按钮
    if (diff > 30) {
      this.setData({ swipeIndex: index })
    }
    // 右滑超过阈值 → 收回删除按钮
    else if (diff < -30) {
      this.setData({ swipeIndex: -1 })
    }
  },

  /**
   * 触摸结束
   */
  handleTouchEnd() {
    // 滑动距离已在 touchmove 中判断，无需额外操作
  },

  /**
   * 关闭所有左滑项
   */
  closeSwipe() {
    this.setData({ swipeIndex: -1 })
  },

  /**
   * 显示删除确认弹窗
   */
  showDeleteConfirm(e: WechatMiniprogram.TouchEvent) {
    const { groupid, title } = e.currentTarget.dataset
    this.setData({
      deleteGroupId: groupid,
      deleteGroupTitle: title,
      swipeIndex: -1
    })

    wx.showModal({
      title: '删除卡牌组',
      content: `确定要删除「${title}」吗？组内所有卡牌和收藏也会被删除，且无法恢复。`,
      confirmColor: '#f87171',
      success: async (res) => {
        if (res.confirm) {
          await this.doDeleteFromList(groupid)
        }
        this.setData({
          deleteGroupId: '',
          deleteGroupTitle: ''
        })
      }
    })
  },

  /**
   * 执行删除 - 调用统一的 deleteCardGroup
   */
  async doDeleteFromList(groupId: string) {
    if (!groupId) return

    try {
      wx.showLoading({ title: '删除中...' })
      await deleteCardGroup(groupId)

      // 从列表中移除
      const newCardGroups = this.data.cardGroups.filter(
        (item: CardGroupItem) => item.groupId !== groupId
      )
      this.setData({
        cardGroups: newCardGroups
      })

      wx.showToast({
        title: '删除成功',
        icon: 'success'
      })

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
  }
})
