import { cardGroupCollection, generateId } from '../../utils/db'
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
}

interface StudyPageData {
  cardGroups: CardGroupItem[]
  isRefreshing: boolean
  showCreateDialog: boolean
  newTitle: string
  newDesc: string
}

Page<StudyPageData, WechatMiniprogram.IAnyObject>({
  data: {
    cardGroups: [],
    isRefreshing: false,
    showCreateDialog: false,
    newTitle: '',
    newDesc: ''
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

    wx.navigateTo({
      url: `/pages/cardDetail/cardDetail?groupId=${groupid}&title=${title}`
    })
  },

  stopPropagation() {
    // 防止点击弹窗内容时关闭弹窗
  }
})
