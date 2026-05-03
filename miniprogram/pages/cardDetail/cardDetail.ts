import { cardCollection, cardGroupCollection, favoriteCollection, studyRecordCollection, generateId } from '../../utils/db'

interface CardItem {
  _id?: string
  cardId: string
  groupId: string
  userId?: string
  front: string
  back: string
  createTime: Date
  _openid?: string
  status?: 'new' | 'learning' | 'mastered' | 'difficult'
  reviewCount?: number
}

interface FavoriteItem {
  _id?: string
  favoriteId: string
  userId?: string
  cardId: string
  groupId: string
  createTime: Date
  _openid?: string
  card?: CardItem
}

interface MasteryData {
  notStarted: number
  basic: number
  good: number
  difficult: number
}

interface CardDetailPageData {
  groupId: string
  title: string
  description: string
  currentTab: number
  tabs: string[]
  cards: CardItem[]
  favorites: FavoriteItem[]
  currentCardIndex: number
  isFlipped: boolean
  cardAnim: string
  studyStartTime: number | null
  showCardDialog: boolean
  dialogMode: 'add' | 'edit'
  editCardId: string
  newFront: string
  newBack: string
  favoriteCardIds: string[]
  isStudying: boolean
  todayStats: {
    toLearn: number
    toReview: number
    studiedTime: number
  }
  formattedStudiedTime: string
  masteryData: MasteryData
  totalCards: number
  studiedCards: number
  donutGradient: string
}

Page<CardDetailPageData, WechatMiniprogram.IAnyObject>({
  data: {
    groupId: '',
    title: '',
    description: '',
    currentTab: 0,
    tabs: ['学习', '目录', '卡牌', '收藏'],
    cards: [],
    favorites: [],
    currentCardIndex: 0,
    isFlipped: false,
    cardAnim: '',
    studyStartTime: null,
    showCardDialog: false,
    dialogMode: 'add',
    editCardId: '',
    newFront: '',
    newBack: '',
    favoriteCardIds: [],
    isStudying: false,
    todayStats: {
      toLearn: 0,
      toReview: 0,
      studiedTime: 0
    },
    formattedStudiedTime: '0秒',
    masteryData: {
      notStarted: 0,
      basic: 0,
      good: 0,
      difficult: 0
    },
    totalCards: 0,
    studiedCards: 0,
    donutGradient: 'conic-gradient(#d1d5db 0deg, #d1d5db 360deg)'
  },

  onLoad(options: any) {
    this.setData({
      groupId: options.groupId || '',
      title: options.title || '',
      description: options.description || ''
    })
    wx.setNavigationBarTitle({
      title: options.title || '卡牌详情'
    })
    this.loadCards()
    this.loadFavorites()

    if (options.studying === '1') {
      this.setData({ isStudying: true })
    }
  },

  onShow() {
    if (this.data.isStudying) {
      this.startStudyTimer()
    } else {
      this.loadCards()
      this.loadFavorites()
    }
  },

  onHide() {
    if (this.data.isStudying) {
      this.stopStudyTimer()
    }
  },

  /**
   * 加载卡牌列表
   */
  async loadCards() {
    try {
      const { data } = await cardCollection.where({
        groupId: this.data.groupId
      }).get()

      const cards = (data as CardItem[]).map(card => ({
        ...card,
        status: card.status || 'new',
        reviewCount: card.reviewCount || 0
      }))

      this.setData({
        cards,
        totalCards: cards.length
      })
      this.calculateStats()
      await this.loadTodayStudyTime()
      console.log('[CardDetail] 加载卡牌成功', cards.length)
    } catch (err) {
      console.error('[CardDetail] 加载卡牌失败', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 加载收藏列表
   */
  async loadFavorites() {
    try {
      const { data } = await favoriteCollection.where({
        groupId: this.data.groupId
      }).get()

      const favorites = data as FavoriteItem[]
      const favoriteCardIds = favorites.map(f => f.cardId)

      const cardsMap = new Map(this.data.cards.map(c => [c.cardId, c]))
      const favoritesWithCards = favorites.map(f => ({
        ...f,
        card: cardsMap.get(f.cardId)
      }))

      this.setData({
        favorites: favoritesWithCards,
        favoriteCardIds
      })
      console.log('[CardDetail] 加载收藏成功', favorites.length)
    } catch (err) {
      console.error('[CardDetail] 加载收藏失败', err)
    }
  },

  /**
   * 计算统计数据
   */
  calculateStats() {
    const { cards } = this.data
    const masteryData = {
      notStarted: 0,
      basic: 0,
      good: 0,
      difficult: 0
    }

    let studiedCards = 0

    cards.forEach(card => {
      const status = card.status || 'new'
      if (status === 'new') {
        masteryData.notStarted++
      } else if (status === 'learning') {
        masteryData.basic++
        studiedCards++
      } else if (status === 'mastered') {
        masteryData.good++
        studiedCards++
      } else if (status === 'difficult') {
        masteryData.difficult++
        studiedCards++
      }
    })

    const totalCards = cards.length
    let donutGradient = 'conic-gradient(#d1d5db 0deg, #d1d5db 360deg)'

    if (totalCards > 0) {
      const notStartedEnd = (masteryData.notStarted / totalCards) * 360
      const basicEnd = notStartedEnd + (masteryData.basic / totalCards) * 360
      const goodEnd = basicEnd + (masteryData.good / totalCards) * 360

      donutGradient = `conic-gradient(#d1d5db ${notStartedEnd}deg, #fbbf24 ${notStartedEnd}deg, #fbbf24 ${basicEnd}deg, #34d399 ${basicEnd}deg, #34d399 ${goodEnd}deg, #f87171 ${goodEnd}deg, #f87171 360deg)`
    }

    this.setData({
      masteryData,
      studiedCards,
      donutGradient,
      formattedStudiedTime: this.formatTime(this.data.todayStats.studiedTime),
      todayStats: {
        toLearn: cards.length > 0 ? Math.min(10, cards.length) : 0,
        toReview: cards.length > 0 ? Math.min(5, cards.length) : 0,
        studiedTime: this.data.todayStats.studiedTime
      }
    })
  },

  async loadTodayStudyTime() {
    try {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const { data } = await studyRecordCollection.where({
        groupId: this.data.groupId
      }).get()

      const studiedTime = (data as any[]).reduce((sum, r) => {
        const recordDate = new Date(r.studyDate)
        if (recordDate >= todayStart) {
          return sum + (r.studyDuration || 0)
        }
        return sum
      }, 0)

      this.setData({
        'todayStats.studiedTime': studiedTime,
        formattedStudiedTime: this.formatTime(studiedTime)
      })

      console.log('[CardDetail] 今日学习时长', studiedTime, '秒')
    } catch (err) {
      console.error('[CardDetail] 加载今日学习时长失败', err)
    }
  },

  /**
   * 切换标签页
   */
  switchTab(e: WechatMiniprogram.TouchEvent) {
    const index = e.currentTarget.dataset.index
    this.setData({
      currentTab: index
    })
    if (index === 3) {
      this.loadFavorites()
    }
  },

  /**
   * 开始学习
   */
  startStudy() {
    if (this.data.cards.length === 0) {
      wx.showToast({
        title: '请先添加卡牌',
        icon: 'none'
      })
      return
    }
    const url = `/pages/cardDetail/cardDetail?groupId=${this.data.groupId}&title=${encodeURIComponent(this.data.title)}&description=${encodeURIComponent(this.data.description)}&studying=1`
    wx.navigateTo({ url })
  },

  /**
   * 开始学习计时
   */
  startStudyTimer() {
    this.setData({
      studyStartTime: Date.now()
    })
  },

  /**
   * 停止学习计时并保存
   */
  stopStudyTimer() {
    if (this.data.studyStartTime) {
      const duration = Math.floor((Date.now() - this.data.studyStartTime) / 1000)
      this.saveStudyRecord(duration)
    }
  },

  /**
   * 保存学习记录
   */
  async saveStudyRecord(duration: number) {
    if (duration < 5) {
      console.log('[CardDetail] 学习时长太短，不保存')
      return
    }
    try {
      await studyRecordCollection.add({
        data: {
          recordId: generateId(),
          groupId: this.data.groupId,
          studyDuration: duration,
          studyDate: new Date()
        }
      })
      console.log('[CardDetail] 保存学习记录成功', duration, '秒')
    } catch (err) {
      console.error('[CardDetail] 保存学习记录失败', err)
    }
  },

  /**
   * 上一张卡牌
   */
  prevCard() {
    if (this.data.currentCardIndex > 0 && !this.data.cardAnim) {
      this.setData({ cardAnim: 'anim-prev-out' })
      setTimeout(() => {
        this.setData({
          currentCardIndex: this.data.currentCardIndex - 1,
          isFlipped: false,
          cardAnim: 'anim-prev-in'
        })
        setTimeout(() => {
          this.setData({ cardAnim: '' })
        }, 300)
      }, 300)
    }
  },

  /**
   * 下一张卡牌
   */
  nextCard() {
    if (this.data.currentCardIndex < this.data.cards.length - 1 && !this.data.cardAnim) {
      this.setData({ cardAnim: 'anim-next-out' })
      setTimeout(() => {
        this.setData({
          currentCardIndex: this.data.currentCardIndex + 1,
          isFlipped: false,
          cardAnim: 'anim-next-in'
        })
        setTimeout(() => {
          this.setData({ cardAnim: '' })
        }, 300)
      }, 300)
    }
  },

  /**
   * 翻牌
   */
  flipCard() {
    this.setData({
      isFlipped: !this.data.isFlipped
    })
  },

  /**
   * 设置掌握程度
   */
  async setMastery(e: WechatMiniprogram.TouchEvent) {
    const status = e.currentTarget.dataset.status as CardItem['status']
    const card = this.data.cards[this.data.currentCardIndex]
    if (!card || !card._id) return

    try {
      await cardCollection.doc(card._id).update({
        data: {
          status: status,
          reviewCount: (card.reviewCount || 0) + 1
        }
      })

      const key = `cards[${this.data.currentCardIndex}].status`
      const reviewKey = `cards[${this.data.currentCardIndex}].reviewCount`
      this.setData({
        [key]: status,
        [reviewKey]: (card.reviewCount || 0) + 1
      })

      this.calculateStats()

      console.log('[CardDetail] 更新掌握程度', card.cardId, status)
    } catch (err) {
      console.error('[CardDetail] 更新掌握程度失败', err)
      wx.showToast({
        title: '记录失败',
        icon: 'none'
      })
    }
  },

  /**
   * 显示添加卡牌弹窗
   */
  showAddCardDialog() {
    this.setData({
      showCardDialog: true,
      dialogMode: 'add',
      editCardId: '',
      newFront: '',
      newBack: ''
    })
  },

  /**
   * 显示编辑卡牌弹窗
   */
  showEditCardDialog(e: WechatMiniprogram.TouchEvent) {
    const { cardid, front, back } = e.currentTarget.dataset
    this.setData({
      showCardDialog: true,
      dialogMode: 'edit',
      editCardId: cardid,
      newFront: front,
      newBack: back
    })
  },

  /**
   * 关闭弹窗
   */
  closeDialog() {
    this.setData({
      showCardDialog: false
    })
  },

  /**
   * 输入正面
   */
  onFrontInput(e: WechatMiniprogram.Input) {
    this.setData({
      newFront: e.detail.value
    })
  },

  /**
   * 输入背面
   */
  onBackInput(e: WechatMiniprogram.Input) {
    this.setData({
      newBack: e.detail.value
    })
  },

  /**
   * 确认保存卡牌
   */
  confirmSaveCard() {
    const { newFront, newBack, dialogMode, editCardId } = this.data
    
    if (!newFront.trim() || !newBack.trim()) {
      wx.showToast({
        title: '请填写完整内容',
        icon: 'none'
      })
      return
    }

    if (dialogMode === 'add') {
      this.createCard(newFront, newBack)
    } else {
      this.updateCard(editCardId, newFront, newBack)
    }
  },

  /**
   * 创建卡牌
   */
  async createCard(front: string, back: string) {
    try {
      wx.showLoading({ title: '添加中...' })

      await cardCollection.add({
        data: {
          cardId: generateId(),
          groupId: this.data.groupId,
          front: front.trim(),
          back: back.trim(),
          createTime: new Date(),
          status: 'new',
          reviewCount: 0
        }
      })

      wx.showToast({
        title: '添加成功',
        icon: 'success'
      })

      this.closeDialog()
      this.loadCards()
      this.calculateStats()
    } catch (err) {
      console.error('[CardDetail] 添加卡牌失败', err)
      wx.showToast({
        title: '添加失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 更新卡牌
   */
  async updateCard(cardId: string, front: string, back: string) {
    try {
      wx.showLoading({ title: '更新中...' })

      const card = this.data.cards.find(c => c.cardId === cardId)
      if (card && card._id) {
        await cardCollection.doc(card._id).update({
          data: {
            front: front.trim(),
            back: back.trim()
          }
        })

        wx.showToast({
          title: '更新成功',
          icon: 'success'
        })

        this.closeDialog()
        this.loadCards()
      }
    } catch (err) {
      console.error('[CardDetail] 更新卡牌失败', err)
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 删除卡牌（带确认）
   */
  deleteCard(e: WechatMiniprogram.TouchEvent) {
    const { cardid } = e.currentTarget.dataset
    
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这张卡牌吗？',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.doDeleteCard(cardid)
        }
      }
    })
  },

  /**
   * 执行删除
   */
  async doDeleteCard(cardId: string) {
    try {
      wx.showLoading({ title: '删除中...' })

      const card = this.data.cards.find(c => c.cardId === cardId)
      if (card && card._id) {
        await cardCollection.doc(card._id).remove()
        
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        })
        
        this.loadCards()
        this.calculateStats()
      }
    } catch (err) {
      console.error('[CardDetail] 删除卡牌失败', err)
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 切换收藏状态
   */
  async toggleFavorite(e: WechatMiniprogram.TouchEvent) {
    const { cardid } = e.currentTarget.dataset
    const isFavorited = this.data.favoriteCardIds.includes(cardid)

    try {
      if (isFavorited) {
        const favorite = this.data.favorites.find(f => f.cardId === cardid)
        if (favorite && favorite._id) {
          await favoriteCollection.doc(favorite._id).remove()
        }
        
        const newFavoriteCardIds = this.data.favoriteCardIds.filter(id => id !== cardid)
        
        this.setData({
          favoriteCardIds: newFavoriteCardIds
        })

        wx.showToast({
          title: '取消收藏',
          icon: 'none'
        })
      } else {
        await favoriteCollection.add({
          data: {
            favoriteId: generateId(),
            cardId: cardid,
            groupId: this.data.groupId,
            createTime: new Date()
          }
        })

        const newFavoriteCardIds = new Set(this.data.favoriteCardIds)
        newFavoriteCardIds.add(cardid)
        
        this.setData({
          favoriteCardIds: Array.from(newFavoriteCardIds)
        })

        wx.showToast({
          title: '收藏成功',
          icon: 'success'
        })
      }

      if (this.data.currentTab === 3) {
        this.loadFavorites()
      }
    } catch (err) {
      console.error('[CardDetail] 操作收藏失败', err)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  },

  /**
   * 格式化时间
   */
  formatTime(seconds: number): string {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    const parts: string[] = []
    if (days > 0) parts.push(`${days}天`)
    if (hours > 0) parts.push(`${hours}小时`)
    if (minutes > 0) parts.push(`${minutes}分钟`)
    if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`)
    return parts.join('')
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation() {
    // 防止点击弹窗内容时关闭弹窗
  },

  deleteCardGroup() {
    wx.showModal({
      title: '删除卡牌组',
      content: `确定要删除「${this.data.title}」吗？组内所有卡牌和收藏也会被删除，且无法恢复。`,
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.doDeleteCardGroup()
        }
      }
    })
  },

  async doDeleteCardGroup() {
    try {
      wx.showLoading({ title: '删除中...' })

      const cardRes = await cardCollection.where({
        groupId: this.data.groupId
      }).get()
      for (const card of cardRes.data as any[]) {
        if (card._id) {
          await cardCollection.doc(card._id).remove()
        }
      }

      const favRes = await favoriteCollection.where({
        groupId: this.data.groupId
      }).get()
      for (const fav of favRes.data as any[]) {
        if (fav._id) {
          await favoriteCollection.doc(fav._id).remove()
        }
      }

      const studyRes = await studyRecordCollection.where({
        groupId: this.data.groupId
      }).get()
      for (const record of studyRes.data as any[]) {
        if (record._id) {
          await studyRecordCollection.doc(record._id).remove()
        }
      }

      const groupRes = await cardGroupCollection.where({
        groupId: this.data.groupId
      }).get()
      for (const group of groupRes.data as any[]) {
        if (group._id) {
          await cardGroupCollection.doc(group._id).remove()
        }
      }

      wx.showToast({
        title: '删除成功',
        icon: 'success'
      })

      console.log('[CardDetail] 删除卡牌组成功', this.data.groupId)

      setTimeout(() => {
        wx.navigateBack()
      }, 1000)
    } catch (err) {
      console.error('[CardDetail] 删除卡牌组失败', err)
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  shareCardGroup() {
    const { title, description, groupId, cards } = this.data

    if (cards.length === 0) {
      wx.showToast({
        title: '暂无卡牌可分享',
        icon: 'none'
      })
      return
    }

    const exportData = {
      version: '1.0',
      group: {
        groupId,
        title,
        description
      },
      cards: cards.map(c => ({
        front: c.front,
        back: c.back,
        status: c.status || 'new',
        reviewCount: c.reviewCount || 0
      })),
      exportTime: new Date().toISOString()
    }

    const jsonStr = JSON.stringify(exportData, null, 2)
    const fileName = `${title || '卡牌组'}.json`
    const fs = wx.getFileSystemManager()
    const tmpPath = `${wx.env.USER_DATA_PATH}/${fileName}`

    fs.writeFile({
      filePath: tmpPath,
      data: jsonStr,
      encoding: 'utf8',
      success: () => {
        console.log('[CardDetail] 临时文件写入成功', tmpPath)
        // @ts-ignore shareFileMessage 类型声明缺失
        wx.shareFileMessage({
          filePath: tmpPath,
          fileName,
          success: () => {
            console.log('[CardDetail] 分享卡牌组成功')
          },
          fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
            console.error('[CardDetail] 分享文件失败', err)
            wx.showToast({
              title: '分享失败',
              icon: 'none'
            })
          }
        })
      },
      fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
        console.error('[CardDetail] 写入文件失败', err)
        wx.showToast({
          title: '分享失败',
          icon: 'none'
        })
      }
    })
  },

  importCards() {
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
            console.error('[CardDetail] 读取文件失败', err)
            wx.showToast({
              title: '读取文件失败',
              icon: 'none'
            })
          }
        })
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          console.error('[CardDetail] 选择文件失败', err)
        }
      }
    })
  },

  processImportData(rawData: string) {
    try {
      let cardsToImport: { front: string; back: string }[] = []

      const parsed = JSON.parse(rawData)

      if (Array.isArray(parsed)) {
        cardsToImport = parsed
      } else if (parsed.cards && Array.isArray(parsed.cards)) {
        cardsToImport = parsed.cards
      } else {
        wx.showToast({
          title: '无效的卡牌数据',
          icon: 'none'
        })
        return
      }

      const validCards = cardsToImport.filter(
        c => c.front && c.back
      )

      if (validCards.length === 0) {
        wx.showToast({
          title: '没有有效卡牌',
          icon: 'none'
        })
        return
      }

      wx.showModal({
        title: '导入卡牌',
        content: `发现 ${validCards.length} 张卡牌，确认导入到当前卡牌组？`,
        confirmColor: '#34d399',
        success: (modalRes) => {
          if (modalRes.confirm) {
            this.doImportCards(validCards)
          }
        }
      })
    } catch (err) {
      console.error('[CardDetail] JSON 解析失败', err)
      wx.showToast({
        title: '文件格式错误',
        icon: 'none'
      })
    }
  },

  async doImportCards(cardsToImport: { front: string; back: string }[]) {
    try {
      wx.showLoading({ title: '导入中...' })

      for (const card of cardsToImport) {
        await cardCollection.add({
          data: {
            cardId: generateId(),
            groupId: this.data.groupId,
            front: card.front.trim(),
            back: card.back.trim(),
            createTime: new Date(),
            status: 'new',
            reviewCount: 0
          }
        })
      }

      wx.showToast({
        title: `已导入${cardsToImport.length}张`,
        icon: 'success'
      })

      this.loadCards()
      this.calculateStats()

      console.log('[CardDetail] 导入卡牌完成', cardsToImport.length)
    } catch (err) {
      console.error('[CardDetail] 导入卡牌失败', err)
      wx.showToast({
        title: '导入失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  }
})
