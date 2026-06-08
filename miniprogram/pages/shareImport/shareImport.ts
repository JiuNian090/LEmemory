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

    // 云端分享功能已暂停，数据仅保存在本地
    this.setData({
      loading: false,
      loadError: '云端分享功能暂不可用，请使用备份导入功能'
    })
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