import { cardGroupCollection, cardCollection, generateId } from '../../utils/db'
import { enableShareMenu } from '../../utils/share'

interface CardData {
  front: string
  back: string
  createTime?: string
  status?: string
  reviewCount?: number
}

interface GroupInfo {
  title: string
  description?: string
}

interface ShareImportPageData {
  loading: boolean
  loadError: string
  group: GroupInfo
  cards: CardData[]
  importing: boolean
  imported: boolean
  /** 显示的页面模式：'data'（有数据可导入）| 'hub'（选择导入方式） */
  mode: 'data' | 'hub'
}

Page<ShareImportPageData, WechatMiniprogram.IAnyObject>({
  data: {
    loading: false,
    loadError: '',
    group: { title: '', description: '' },
    cards: [],
    importing: false,
    imported: false,
    mode: 'hub'
  },

  onLoad(options: any) {
    enableShareMenu()

    // 优先尝试从 URL 参数中解析卡牌数据（来自 onShareAppMessage 分享）
    const encodedData = options.data
    if (encodedData) {
      this.parseAndLoadData(encodedData)
      return
    }

    // 尝试从全局数据获取分享数据
    const app = getApp()
    const sharedData = (app as any).globalData?.sharedCardData
    if (sharedData) {
      this.displaySharedData(sharedData)
      return
    }

    // 无数据 → 显示 hub 页面，让用户选择导入方式
    this.setData({ loading: false, mode: 'hub' })
  },

  /**
   * 解析 URL 中的 base64 编码数据
   */
  parseAndLoadData(encodedData: string) {
    try {
      const jsonStr = decodeURIComponent(encodedData)
      const parsed = JSON.parse(jsonStr)

      let cards: CardData[] = []
      let group: GroupInfo = { title: '分享的卡牌组' }

      if (parsed.cards && Array.isArray(parsed.cards)) {
        cards = parsed.cards
        if (parsed.group?.title) {
          group.title = parsed.group.title
        }
        if (parsed.group?.description) {
          group.description = parsed.group.description
        }
        if (parsed.summary?.cardCount) {
          group.title += ` (${parsed.summary.cardCount}张)`
        }
      } else if (Array.isArray(parsed)) {
        cards = parsed
      } else {
        throw new Error('无效的卡牌数据格式')
      }

      this.displaySharedData({ cards, group })
    } catch (err) {
      console.error('[ShareImport] 数据解析失败', err)
      this.setData({
        loading: false,
        loadError: '卡牌数据解析失败，请尝试使用文件导入',
        mode: 'hub'
      })
    }
  },

  /**
   * 展示解析后的分享数据
   */
  displaySharedData(data: { cards: CardData[]; group: GroupInfo }) {
    const validCards = data.cards.filter(c => c.front && c.back)
    if (validCards.length === 0) {
      this.setData({
        loading: false,
        loadError: '没有有效的卡牌数据',
        mode: 'hub'
      })
      return
    }

    this.setData({
      loading: false,
      group: data.group,
      cards: validCards,
      mode: 'data',
      loadError: ''
    })
  },

  /**
   * 从文件导入卡牌（类似 cardDetail 的 importCards）
   */
  importFromFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: (res) => {
        const file = res.tempFiles[0]
        const fs = wx.getFileSystemManager()

        fs.readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: (readRes) => {
            this.processImportData(readRes.data as string)
          },
          fail: (err) => {
            console.error('[ShareImport] 读取文件失败', err)
            wx.showToast({ title: '读取文件失败', icon: 'none' })
          }
        })
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          console.error('[ShareImport] 选择文件失败', err)
        }
      }
    })
  },

  /**
   * 从剪贴板导入卡牌 JSON
   */
  importFromClipboard() {
    wx.getClipboardData({
      success: (res) => {
        const data = res.data.trim()
        if (!data) {
          wx.showToast({ title: '剪贴板为空', icon: 'none' })
          return
        }
        // 尝试提取 JSON（支持 markdown 代码块包裹）
        const jsonMatch = data.match(/```(?:json)?\s*([\s\S]*?)```/) ||
          data.match(/\[[\s\S]*\]/) ||
          data.match(/\{[\s\S]*\}/)
        const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : data
        this.processImportData(jsonStr)
      },
      fail: (err) => {
        console.error('[ShareImport] 读取剪贴板失败', err)
        wx.showToast({ title: '读取剪贴板失败', icon: 'none' })
      }
    })
  },

  /**
   * 处理导入的 JSON 数据
   */
  processImportData(rawData: string) {
    try {
      const parsed = JSON.parse(rawData)

      let cards: CardData[] = []
      let group: GroupInfo = { title: '导入的卡牌组' }

      if (Array.isArray(parsed)) {
        cards = parsed
      } else if (parsed.cards && Array.isArray(parsed.cards)) {
        cards = parsed.cards
        if (parsed.group?.title) {
          group.title = parsed.group.title
        }
        if (parsed.group?.description) {
          group.description = parsed.group.description
        }
      } else {
        wx.showToast({ title: '无效的卡牌数据', icon: 'none' })
        return
      }

      const validCards = cards.filter(c => c.front && c.back)
      if (validCards.length === 0) {
        wx.showToast({ title: '没有有效卡牌', icon: 'none' })
        return
      }

      this.setData({
        loading: false,
        group,
        cards: validCards,
        mode: 'data',
        loadError: ''
      })
    } catch (err) {
      console.error('[ShareImport] JSON 解析失败', err)
      wx.showToast({ title: '文件格式错误', icon: 'none' })
    }
  },

  /**
   * 导入卡牌到我的卡牌组
   */
  async importGroup() {
    if (this.data.importing || this.data.cards.length === 0) return

    this.setData({ importing: true })

    try {
      const newGroupId = generateId()
      const { title, description } = this.data.group

      await cardGroupCollection.add({
        data: {
          groupId: newGroupId,
          title: title || '导入的卡牌组',
          description: description || '',
          createTime: new Date(),
          updateTime: new Date()
        }
      })

      for (const card of this.data.cards) {
        await cardCollection.add({
          data: {
            cardId: generateId(),
            groupId: newGroupId,
            front: card.front.trim(),
            back: card.back.trim(),
            createTime: new Date(),
            status: 'new',
            reviewCount: 0
          }
        })
      }

      this.setData({ imported: true, importing: false })

      wx.showToast({ title: `已导入${this.data.cards.length}张卡牌`, icon: 'success', duration: 1500 })

      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/cardDetail/cardDetail?groupId=${newGroupId}&title=${encodeURIComponent(title || '导入的卡牌组')}&description=${encodeURIComponent(description || '')}`
        })
      }, 1500)
    } catch (err: any) {
      console.error('[ShareImport] 导入失败', err)
      this.setData({ importing: false })
      wx.showToast({ title: '导入失败', icon: 'none' })
    }
  },

  /**
   * 返回首页
   */
  goHome() {
    wx.switchTab({ url: '/pages/study/study' })
  },

  onShareAppMessage() {
    return {
      title: 'LEmemory - 卡牌导入',
      path: '/pages/shareImport/shareImport'
    }
  },

  onShareTimeline() {
    return {
      title: 'LEmemory - 卡牌导入'
    }
  }
})