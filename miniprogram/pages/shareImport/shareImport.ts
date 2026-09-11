import { cardGroupCollection, cardCollection, generateId } from '../../utils/db'
import { parseCardsFromDelimited } from '../../utils/csv'
import { isSpreadsheetFile, parseCardsFromXlsx } from '../../utils/xlsx'
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

/** 尝试把文本解析为卡牌 JSON；非合法卡牌 JSON 时返回 null */
function parseJsonCards(rawData: string): { cards: CardData[]; group: GroupInfo } | null {
  try {
    const parsed = JSON.parse(rawData)
    if (Array.isArray(parsed)) {
      return { cards: parsed as CardData[], group: { title: '导入的卡牌组' } }
    }
    if (parsed && Array.isArray(parsed.cards)) {
      const group: GroupInfo = { title: '导入的卡牌组' }
      if (parsed.group?.title) group.title = parsed.group.title
      if (parsed.group?.description) group.description = parsed.group.description
      return { cards: parsed.cards as CardData[], group }
    }
    return null
  } catch (_) {
    return null
  }
}

/** 依次尝试原文与其中的 markdown 代码块片段 */
function buildCandidates(raw: string): string[] {
  const candidates = [raw]
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const codeBlockBody = codeBlock && codeBlock[1]
  if (codeBlockBody) candidates.push(codeBlockBody)
  return candidates
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
   * 解析 URL 中的编码数据
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
    } catch (err: any) {
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

  importFromFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: (res) => {
        const file = res.tempFiles[0]
        this.readImportFile(file.path, file.name)
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          console.error('[ShareImport] 选择文件失败', err)
        }
      }
    })
  },

  /**
   * 按扩展名读取导入文件：表格（.xlsx/.xls）走二进制解析，其余按文本解析
   */
  readImportFile(filePath: string, fileName: string) {
    const fs = wx.getFileSystemManager()

    if (isSpreadsheetFile(fileName || filePath)) {
      fs.readFile({
        filePath,
        success: (readRes) => {
          const cards = parseCardsFromXlsx(readRes.data as ArrayBuffer)
          if (cards.length === 0) {
            wx.showToast({ title: '表格中没有可用卡牌', icon: 'none' })
            return
          }
          this.showPreview(cards, { title: '导入的卡牌组' })
        },
        fail: (err) => {
          console.error('[ShareImport] 读取表格失败', err)
          wx.showToast({ title: '读取文件失败', icon: 'none' })
        }
      })
      return
    }

    fs.readFile({
      filePath,
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
        this.processImportData(data)
      },
      fail: (err) => {
        console.error('[ShareImport] 读取剪贴板失败', err)
        wx.showToast({ title: '读取剪贴板失败', icon: 'none' })
      }
    })
  },

  /**
   * 处理导入数据：先按 JSON 解析，失败则按 CSV / 分隔符文本解析
   */
  processImportData(rawData: string) {
    const candidates = buildCandidates(rawData)

    for (const candidate of candidates) {
      const jsonResult = parseJsonCards(candidate)
      if (jsonResult) {
        this.showPreview(jsonResult.cards, jsonResult.group)
        return
      }
    }

    for (const candidate of candidates) {
      const textResult = parseCardsFromDelimited(candidate)
      if (textResult) {
        this.showPreview(textResult.cards, { title: '导入的卡牌组' })
        return
      }
    }

    wx.showToast({ title: '无法识别文件格式', icon: 'none' })
  },

  /** 展示导入预览 */
  showPreview(cards: CardData[], group: GroupInfo) {
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
  },

  /**
   * 导入卡牌到我的卡牌组
   */
  async importGroup() {
    if (this.data.importing || this.data.imported || this.data.cards.length === 0) return

    this.setData({ importing: true })

    let createdGroupId: string | null = null
    const createdCardIds: string[] = []

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
      // LocalCollection.doc() 按业务主键匹配，回滚必须用 groupId / cardId
      createdGroupId = newGroupId

      for (const card of this.data.cards) {
        const newCardId = generateId()
        await cardCollection.add({
          data: {
            cardId: newCardId,
            groupId: newGroupId,
            front: card.front.trim(),
            back: card.back.trim(),
            createTime: new Date(),
            status: 'new',
            reviewCount: 0
          }
        })
        createdCardIds.push(newCardId)
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

      // 回滚：删除已创建的卡片
      for (const cardId of createdCardIds) {
        try { await cardCollection.doc(cardId).remove() } catch { /* 忽略单条删除失败 */ }
      }
      // 删除已创建的卡片组
      if (createdGroupId) {
        try { await cardGroupCollection.doc(createdGroupId).remove() } catch { /* 忽略删除失败 */ }
      }

      this.setData({ importing: false })
      wx.showToast({ title: '导入失败，已回滚', icon: 'none' })
    }
  },

  /**
   * 返回首页
   */
  goHome() {
    wx.switchTab({ url: '/pages/study/study' })
  },

  onShareAppMessage() {
    // 如果有已解析的数据，构建分享链接传递卡片数据
    const cards = this.data.cards
    if (cards.length > 0) {
      const shareData = {
        group: this.data.group,
        cards: cards.slice(0, 50), // 限制分享数量
        summary: { cardCount: cards.length }
      }
      const encoded = encodeURIComponent(JSON.stringify(shareData))
      return {
        title: `LEmemory - ${this.data.group?.title || '卡牌'} (${cards.length}张)`,
        path: `/pages/shareImport/shareImport?data=${encoded}`
      }
    }
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