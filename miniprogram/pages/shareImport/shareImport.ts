import { cardGroupCollection, cardCollection, generateId } from '../../utils/db'

interface SharedCard {
  cardId: string
  front: string
  back: string
}

interface SharedGroup {
  groupId: string
  title: string
  description?: string
  cardCount: number
}

interface ShareImportPageData {
  loading: boolean
  loadError: string
  group: SharedGroup
  cards: SharedCard[]
  importing: boolean
  imported: boolean
}

Page<ShareImportPageData, WechatMiniprogram.IAnyObject>({
  data: {
    loading: true,
    loadError: '',
    group: { groupId: '', title: '', cardCount: 0 },
    cards: [],
    importing: false,
    imported: false
  },

  onLoad(options: any) {
    const groupId = options.groupId
    if (groupId) {
      this.loadSharedGroup(groupId)
    } else {
      this.setData({
        loading: false,
        loadError: '无效的分享链接'
      })
    }
  },

  async loadSharedGroup(groupId?: string) {
    const gid = groupId || this.data.group.groupId
    if (!gid) {
      this.setData({
        loading: false,
        loadError: '无效的卡牌组ID'
      })
      return
    }

    this.setData({ loading: true, loadError: '' })

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'cardGroup_operate',
        data: { action: 'getSharedGroup', groupId: gid }
      })

      const res = result as any
      if (!res || !res.success || !res.data) {
        throw new Error('获取卡牌组失败')
      }

      const groupData = res.data.group
      const cardsData = (res.data.cards || []) as SharedCard[]

      if (!groupData) {
        throw new Error('卡牌组不存在或已删除')
      }

      this.setData({
        loading: false,
        group: {
          groupId: groupData.groupId,
          title: groupData.title || '未命名卡牌组',
          description: groupData.description || '',
          cardCount: cardsData.length
        },
        cards: cardsData
      })
    } catch (err: any) {
      console.error('[ShareImport] 加载分享卡牌组失败', err)
      this.setData({
        loading: false,
        loadError: err.errMsg || err.message || '加载失败，请重试'
      })
    }
  },

  async importGroup() {
    if (this.data.importing || this.data.cards.length === 0) return

    this.setData({ importing: true })

    try {
      const newGroupId = generateId()
      const { title, description } = this.data.group

      // 创建新卡牌组
      await cardGroupCollection.add({
        data: {
          groupId: newGroupId,
          title: title,
          description: description || '',
          createTime: new Date(),
          updateTime: new Date()
        }
      })

      // 逐张导入卡牌
      for (const card of this.data.cards) {
        await cardCollection.add({
          data: {
            cardId: generateId(),
            groupId: newGroupId,
            front: card.front,
            back: card.back,
            createTime: new Date(),
            status: 'new',
            reviewCount: 0
          }
        })
      }

      this.setData({ imported: true, importing: false })

      // 跳转到新卡牌组
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/cardDetail/cardDetail?groupId=${newGroupId}&title=${encodeURIComponent(title)}&description=${encodeURIComponent(description || '')}`
        })
      }, 1500)
    } catch (err: any) {
      console.error('[ShareImport] 导入失败', err)
      this.setData({ importing: false })
      wx.showToast({
        title: '导入失败',
        icon: 'none'
      })
    }
  }
})