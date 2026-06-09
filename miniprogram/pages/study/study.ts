import { cardGroupCollection, generateId, deleteCardGroup } from '../../utils/db'
import { formatDate } from '../../utils/time'
import { showErrorToast } from '../../utils/error'
import { enableShareMenu } from '../../utils/share'

// 预选表情列表
const EMOJIS = [
  '📚', '🎯', '💡', '🌟', '🔥', '💪', '🎨', '🎵',
  '🧠', '💎', '🏆', '⭐', '🌈', '🎈', '💫', '✨',
  '📖', '✏️', '📝', '🔍', '🎮', '🌍', '🔬', '📐'
]

interface CardGroupItem {
  _id?: string
  groupId: string
  userId?: string
  title: string
  description?: string
  emoji?: string
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
  selectedEmoji: string
  showEmojiPicker: boolean
  emojis: string[]
  showEditDialog: boolean
  editGroupId: string
  editTitle: string
  editDesc: string
  editEmoji: string
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
    selectedEmoji: '📚',
    showEmojiPicker: false,
    emojis: EMOJIS,
    showEditDialog: false,
    editGroupId: '',
    editTitle: '',
    editDesc: '',
    editEmoji: '📚',
    deleteGroupId: '',
    deleteGroupTitle: '',
    swipeIndex: -1,
    startX: 0
  },

  onLoad() {
    enableShareMenu()
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
    } catch (err: any) {
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
        return formatDate(new Date(time))
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
      newDesc: '',
      selectedEmoji: '📚',
      showEmojiPicker: false
    })
  },

  /**
   * 关闭创建弹窗
   */
  closeDialog() {
    this.setData({
      showCreateDialog: false,
      showEditDialog: false
    })
  },

  /**
   * 切换表情选择器
   */
  toggleEmojiPicker() {
    this.setData({
      showEmojiPicker: !this.data.showEmojiPicker
    })
  },

  /**
   * 选择表情
   */
  onEmojiSelect(e: WechatMiniprogram.TouchEvent) {
    const emoji = e.currentTarget.dataset.emoji as string
    this.setData({
      selectedEmoji: emoji,
      showEmojiPicker: false
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
    const { newTitle, newDesc, selectedEmoji } = this.data

    console.log('[StudyPage] 确认创建，标题:', `"${newTitle}"`)

    if (!newTitle.trim()) {
      wx.showToast({
        title: '请输入标题',
        icon: 'none'
      })
      return
    }

    this.addCardGroup(newTitle, newDesc, selectedEmoji)
  },

  /**
   * 添加卡牌组到数据库
   */
  async addCardGroup(title: string, description: string, emoji: string) {
    try {
      wx.showLoading({ title: '创建中...' })

      console.log('[StudyPage] 正在创建卡牌组:', title)
      await cardGroupCollection.add({
        data: {
          groupId: generateId(),
          title: title.trim(),
          description: description.trim(),
          emoji: emoji,
          createTime: new Date(),
          updateTime: new Date()
        }
      })

      // 先关闭 loading，再显示成功提示，避免 UI 冲突
      wx.hideLoading()
      wx.showToast({
        title: '创建成功',
        icon: 'success'
      })

      this.closeDialog()
      this.loadCardGroups()
    } catch (err: any) {
      console.error('[StudyPage] 创建卡牌组失败', err)
      wx.hideLoading()
      showErrorToast(err)
    }
  },

  /**
   * 跳转到卡牌详情页
   */
  goToDetail(e: WechatMiniprogram.TouchEvent) {
    const { groupid, title } = e.currentTarget.dataset

    // 先关闭任何打开的滑动项，避免跳转前闪现
    this.setData({ swipeIndex: -1 })

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
      startX: e.touches[0].clientX
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
    } catch (err: any) {
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
   * 显示编辑弹窗
   */
  showEditDialog(e: WechatMiniprogram.TouchEvent) {
    const { groupid, title, desc, emoji } = e.currentTarget.dataset
    this.setData({
      editGroupId: groupid,
      editTitle: title || '',
      editDesc: desc || '',
      editEmoji: emoji || '📚',
      showEditDialog: true,
      showEmojiPicker: false,
      swipeIndex: -1
    })
  },

  /**
   * 编辑 - 输入标题
   */
  onEditTitleInput(e: WechatMiniprogram.Input) {
    this.setData({
      editTitle: e.detail.value
    })
  },

  /**
   * 编辑 - 输入描述
   */
  onEditDescInput(e: WechatMiniprogram.Input) {
    this.setData({
      editDesc: e.detail.value
    })
  },

  /**
   * 编辑 - 选择表情
   */
  onEditEmojiSelect(e: WechatMiniprogram.TouchEvent) {
    const emoji = e.currentTarget.dataset.emoji as string
    this.setData({
      editEmoji: emoji,
      showEmojiPicker: false
    })
  },

  /**
   * 确认编辑卡牌组
   */
  confirmEdit() {
    const { editGroupId, editTitle, editDesc, editEmoji } = this.data

    if (!editTitle.trim()) {
      wx.showToast({
        title: '请输入标题',
        icon: 'none'
      })
      return
    }

    this.updateCardGroup(editGroupId, editTitle.trim(), editDesc.trim(), editEmoji)
  },

  /**
   * 更新卡牌组
   */
  async updateCardGroup(groupId: string, title: string, description: string, emoji: string) {
    try {
      wx.showLoading({ title: '更新中...' })

      // 找到本地数据中的记录，获取 _id
      const target = this.data.cardGroups.find(g => g.groupId === groupId)
      if (!target || !target._id) {
        wx.hideLoading()
        wx.showToast({ title: '未找到该卡牌组', icon: 'none' })
        return
      }

      await cardGroupCollection.doc(target._id).update({
        data: {
          title,
          description,
          emoji,
          updateTime: new Date()
        }
      })

      wx.hideLoading()
      wx.showToast({
        title: '更新成功',
        icon: 'success'
      })

      this.setData({ showEditDialog: false })
      this.loadCardGroups()
    } catch (err: any) {
      console.error('[StudyPage] 更新卡牌组失败', err)
      wx.hideLoading()
      showErrorToast(err)
    }
  },

  onShareAppMessage() {
    return {
      title: 'LEmemory - 记忆卡片学习',
      path: '/pages/study/study'
    }
  },

  onShareTimeline() {
    return {
      title: 'LEmemory - 记忆卡片学习'
    }
  }
})
