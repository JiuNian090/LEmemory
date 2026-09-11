import { cardGroupCollection, cardCollection, favoriteCollection, studyRecordCollection, generateId, deleteCardGroup, addDailyStudyDuration, getDailyStudyMap, getSrsSettings } from '../../utils/db'
import { showErrorToast } from '../../utils/error'
import { buildCardsCsv, parseCardsFromDelimited } from '../../utils/csv'
import { isSpreadsheetFile, parseCardsFromXlsx } from '../../utils/xlsx'
import { buildCloze, buildQuizOptions, isAnswerCorrect, QUIZ_MODE_LABELS, type QuizMode } from '../../utils/quiz'
import { applyMastery, buildReviewQueue, isFailed, todayKey } from '../../utils/srs'
import type { IAppOption, MasteryStatus, SrsState } from '../../utils/types'
import { enableShareMenu } from '../../utils/share'

const app = getApp<IAppOption>()

/** Fisher-Yates 洗牌，返回打乱后的新数组（不改动入参） */
function shuffleList<T>(list: readonly T[]): T[] {
  const result = list.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }
  return result
}

/** 解析导入文本为卡牌：先试 JSON，再试 CSV / 分隔符文本，均失败时返回空数组 */
function parseImportCards(rawData: string): { front: string; back: string }[] {
  const candidates = [rawData]
  const codeBlock = rawData.match(/```(?:json)?\s*([\s\S]*?)```/)
  const codeBlockBody = codeBlock && codeBlock[1]
  if (codeBlockBody) candidates.push(codeBlockBody)

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (Array.isArray(parsed)) return filterValidCards(parsed)
      if (parsed && Array.isArray(parsed.cards)) return filterValidCards(parsed.cards)
    } catch (_) {
      // 不是 JSON，继续尝试分隔符文本
    }
  }

  for (const candidate of candidates) {
    const textResult = parseCardsFromDelimited(candidate)
    if (textResult) return filterValidCards(textResult.cards)
  }

  return []
}

/** 过滤出正反面都非空的卡牌 */
function filterValidCards(cards: { front?: string; back?: string }[]): { front: string; back: string }[] {
  return cards.filter(card => card.front && card.back) as { front: string; back: string }[]
}

interface CardItem {
  _id?: string
  cardId: string
  groupId: string
  userId?: string
  front: string
  back: string
  createTime: Date
  _openid?: string
  status?: MasteryStatus
  reviewCount?: number
  srs?: SrsState
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
  groupEmoji: string
  currentTab: number
  tabs: string[]
  cards: any[]
  displayCards: any[]
  favorites: any[]
  currentCardIndex: number
  isFlipped: boolean
  cardAnim: string
  studyStartTime: Date | null | number
  showCardDialog: boolean
  dialogMode: 'add' | 'edit'
  editCardId: string
  newFront: string
  newBack: string
  favoriteCardIds: string[]
  isStudying: boolean
  isQuiz: boolean
  /** 当前学习会话的卡牌队列（与全量 cards 分离，避免学习时污染列表页） */
  sessionCards: CardItem[]
  /** 测验题型；空字符串表示非测验 */
  quizMode: QuizMode | ''
  /** 选择题备选项 */
  quizOptions: string[]
  /** 填空/拼写题的作答输入 */
  quizInput: string
  /** 填空题挖空后的背面文本；为空表示本题退化为拼写题 */
  quizClozeText: string
  /** 填空题挖空片段提示，如「2 字」 */
  quizClozeHint: string
  /** 标准答案（填空题为挖空片段，其余为卡牌背面） */
  quizCorrectAnswer: string
  /** 选择题中用户点选的选项 */
  quizSelectedOption: string
  quizAnswered: boolean
  quizIsCorrect: boolean
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
  displayStart: number
  displayEnd: number
  isLoadingMore: boolean
  // 实时计时
  elapsedSeconds: number
  timerDisplay: string
}

Page<CardDetailPageData, WechatMiniprogram.IAnyObject>({
  data: {
    groupId: '',
    title: '',
    description: '',
    groupEmoji: '🎴',
    currentTab: 0,
    tabs: ['学习', '目录', '卡牌', '收藏'],
    cards: [],
    sessionCards: [],
    displayCards: [],
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
    isQuiz: false,
    quizMode: '',
    quizOptions: [],
    quizInput: '',
    quizClozeText: '',
    quizClozeHint: '',
    quizCorrectAnswer: '',
    quizSelectedOption: '',
    quizAnswered: false,
    quizIsCorrect: false,
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
    donutGradient: 'conic-gradient(#d1d5db 0deg, #d1d5db 360deg)',
    displayStart: 0,
    displayEnd: 10,
    isLoadingMore: false,
    elapsedSeconds: 0,
    timerDisplay: '00:00'
  },

  pageSize: 10,

  /** 本次会话内已安排过重练的卡牌，保证每张卡每次会话最多重练一次 */
  relearnedCardIds: null as Set<string> | null,

  // 计时器
  timerInterval: null as number | null,
  saveInterval: null as number | null,
  /** 上次保存时的时间戳 */
  lastSaveTime: 0,
  /** 当前会话累积秒数 */
  sessionSeconds: 0,

  async onLoad(options: any) {
    enableShareMenu()
    const title = options.title ? decodeURIComponent(options.title) : ''
    const description = options.description ? decodeURIComponent(options.description) : ''
    
    this.setData({
      groupId: options.groupId || '',
      title: title,
      description: description
    })
    wx.setNavigationBarTitle({
      title: title || '卡牌详情'
    })

    // 从卡牌组加载 emoji
    this.loadGroupEmoji(options.groupId)

    // 先加载卡牌，再加载收藏（loadFavorites 依赖 cards 数据）
    await this.loadCards()
    await this.loadFavorites()
  },

  onShow() {
    if (this.data.isStudying) {
      // 只启动尚未运行的计时器（onHide 已停止，onShow 重新开始）
      if (!this.timerInterval) {
        this.startStudyTimer()
      }
    } else {
      this.loadGroupEmoji(this.data.groupId)
      this.loadCards()
      this.loadFavorites()
    }
  },

  /**
   * 加载卡牌组表情图标
   */
  async loadGroupEmoji(groupId: string) {
    if (!groupId) return
    try {
      const { data } = await cardGroupCollection.where({ groupId }).get()
      if (data.length > 0 && data[0].emoji) {
        this.setData({ groupEmoji: data[0].emoji })
      }
    } catch {
      // 静默失败，使用默认 emoji
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
  async loadCards(reset: boolean = true) {
    try {
      const { data } = await cardCollection.where({
        groupId: this.data.groupId
      }).get()

      const cards = (data as CardItem[]).map(card => ({
        ...card,
        status: card.status || 'new',
        reviewCount: card.reviewCount || 0
      }))

      if (reset) {
        this.setData({
          cards,
          totalCards: cards.length,
          displayStart: 0,
          displayEnd: Math.min(this.pageSize, cards.length)
        })
        this.updateDisplayCards()
      } else {
        this.setData({
          cards,
          totalCards: cards.length
        })
      }
      this.calculateStats()
      await this.loadTodayStudyTime()
      console.log('[CardDetail] 加载卡牌成功', cards.length)
    } catch (err: any) {
      console.error('[CardDetail] 加载卡牌失败', err)
      showErrorToast(err)
    }
  },

  /**
   * 更新显示的卡牌（懒加载）
   */
  updateDisplayCards() {
    const { cards, displayStart, displayEnd } = this.data
    const displayCards = cards.slice(displayStart, displayEnd)
    this.setData({ displayCards })
  },

  /**
   * 加载更多卡牌
   */
  loadMoreCards() {
    if (this.data.isLoadingMore) return
    
    const { cards, displayEnd } = this.data
    if (displayEnd >= cards.length) return

    this.setData({ isLoadingMore: true })

    setTimeout(() => {
      const newEnd = Math.min(displayEnd + this.pageSize, cards.length)
      this.setData({
        displayEnd: newEnd,
        isLoadingMore: false
      })
      this.updateDisplayCards()
    }, 300)
  },

  /**
   * 处理滚动到底部
   */
  onScrollToLower() {
    if (this.data.currentTab === 2) {
      this.loadMoreCards()
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
    } catch (err: any) {
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

    const queue = buildReviewQueue(cards, getSrsSettings(), todayKey())

    this.setData({
      masteryData,
      studiedCards,
      donutGradient,
      formattedStudiedTime: this.formatTime(this.data.todayStats.studiedTime),
      todayStats: {
        toLearn: queue.fresh.length,
        toReview: queue.due.length,
        studiedTime: this.data.todayStats.studiedTime
      }
    })
  },

  async loadTodayStudyTime() {
    const today = new Date().toISOString().split('T')[0]

    // 1. 总是先从本地 study_daily 读取基础值（保证离线/未登录也有数据显示）
    const localDaily = getDailyStudyMap()[today]
    const localTotal = localDaily?.groups[this.data.groupId] || 0
    this.setData({
      'todayStats.studiedTime': localTotal,
      formattedStudiedTime: this.formatTime(localTotal)
    })
    console.log('[CardDetail] 今日学习时长（本地）', localTotal, '秒')

    // 2. 如有登录，尝试从云端获取补充（跨设备汇总数据）
    const username = app.globalData.userInfo?.username
    if (!username) return

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'study_sync',
        data: {
          action: 'getTodayTotal',
          username,
          groupId: this.data.groupId
        }
      })
      const res = result as { success: boolean; total: number }
      if (res.success) {
        // 云端总时长（包含其他设备同步的数据）与当前显示值合并
        const total = Math.max(res.total, this.data.todayStats.studiedTime)
        this.setData({
          'todayStats.studiedTime': total,
          formattedStudiedTime: this.formatTime(total)
        })
        console.log('[CardDetail] 今日学习时长（云端汇总）', total, '秒')
      }
    } catch (err: any) {
      console.error('[CardDetail] 云端获取今日学习时长失败，使用本地数据', err)
      // 本地已在上方设置，无需重复操作
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
   * 开始学习：按 SRS 调度构建今日队列（到期待复习 + 新卡）
   */
  startStudy() {
    if (this.data.cards.length === 0) {
      wx.showToast({
        title: '请先添加卡牌',
        icon: 'none'
      })
      return
    }
    const queue = buildReviewQueue(this.data.cards, getSrsSettings(), todayKey())
    this.beginStudy([...queue.due, ...queue.fresh], false, '今日没有需要复习的卡片')
  },

  /**
   * 开始测验：先选题型，再打乱全部卡牌顺序
   */
  startQuiz() {
    if (this.data.cards.length === 0) {
      wx.showToast({
        title: '请先添加卡牌',
        icon: 'none'
      })
      return
    }
    const modes: QuizMode[] = ['choice', 'cloze', 'spelling']
    wx.showActionSheet({
      itemList: [QUIZ_MODE_LABELS.choice, QUIZ_MODE_LABELS.cloze, QUIZ_MODE_LABELS.spelling],
      success: (res) => {
        const mode = modes[res.tapIndex]
        if (mode) this.beginQuiz(mode)
      }
    })
  },

  /**
   * 进入测验模式并准备第一题
   */
  beginQuiz(mode: QuizMode) {
    if (!this.beginStudy(shuffleList(this.data.cards), true, '请先添加卡牌')) return
    this.setData({ quizMode: mode })
    this.prepareQuestion()
  },

  /**
   * 专项练习：只练某一掌握程度的卡牌
   */
  startPractice(e: WechatMiniprogram.TouchEvent) {
    const status = e.currentTarget.dataset.status as MasteryStatus
    const filtered = this.data.cards.filter(card => (card.status || 'new') === status)
    const emptyTip = status === 'difficult' ? '暂无疑难卡片' : '暂无未掌握卡片'
    this.beginStudy(filtered, false, emptyTip)
  },

  /**
   * 进入学习模式（统一入口）
   */
  beginStudy(sessionCards: CardItem[], isQuiz: boolean, emptyTip: string): boolean {
    if (sessionCards.length === 0) {
      wx.showToast({
        title: emptyTip,
        icon: 'none'
      })
      return false
    }
    this.relearnedCardIds = new Set()
    this.setData({
      sessionCards,
      isStudying: true,
      isQuiz,
      quizMode: '',
      quizOptions: [],
      quizInput: '',
      quizClozeText: '',
      quizClozeHint: '',
      quizCorrectAnswer: '',
      quizSelectedOption: '',
      quizAnswered: false,
      quizIsCorrect: false,
      currentCardIndex: 0,
      isFlipped: false
    })
    this.startStudyTimer()
    return true
  },

  /**
   * 退出学习/测验模式
   */
  exitStudyMode() {
    this.stopStudyTimer()
    this.setData({ isStudying: false, isQuiz: false, sessionCards: [], currentCardIndex: 0, isFlipped: false })
  },

  /**
   * 当轮重练：遗忘的卡牌排到队尾再出现一次（每张卡每次会话最多一次）
   */
  appendRelearnCard(status: MasteryStatus) {
    if (!isFailed(status)) return
    const relearned = this.relearnedCardIds
    if (!relearned) return
    const card = this.data.sessionCards[this.data.currentCardIndex]
    if (!card || relearned.has(card.cardId)) return
    relearned.add(card.cardId)
    this.setData({ sessionCards: [...this.data.sessionCards, card] })
  },

  /**
   * 洗牌（Fisher-Yates）——返回打乱后的新数组
   */
  shuffleCards() {
    return shuffleList(this.data.cards)
  },

  /**
   * 为当前卡牌生成题目（选择题选项 / 填空题挖空）
   */
  prepareQuestion() {
    const card = this.data.sessionCards[this.data.currentCardIndex]
    if (!card) return

    const patch: Record<string, any> = {
      quizInput: '',
      quizSelectedOption: '',
      quizAnswered: false,
      quizIsCorrect: false,
      quizCorrectAnswer: card.back,
      quizClozeText: '',
      quizClozeHint: '',
      quizOptions: []
    }

    if (this.data.quizMode === 'choice') {
      const pool = this.data.cards
        .filter(item => item.cardId !== card.cardId)
        .map(item => item.back as string)
      patch.quizOptions = buildQuizOptions(card.back, pool)
    } else if (this.data.quizMode === 'cloze') {
      const cloze = buildCloze(card.back)
      if (cloze) {
        patch.quizClozeText = cloze.display
        patch.quizClozeHint = cloze.hint
        patch.quizCorrectAnswer = cloze.answer
      }
      // 无法挖空（如整段无分隔）时 quizClozeText 保持为空，本题退化为拼写题
    }

    this.setData(patch)
  },

  /**
   * 选择题作答
   */
  chooseQuizOption(e: WechatMiniprogram.TouchEvent) {
    if (this.data.quizAnswered) return
    const option = e.currentTarget.dataset.option as string
    this.setData({ quizSelectedOption: option })
    this.applyQuizResult(option === this.data.quizCorrectAnswer)
  },

  /**
   * 填空/拼写题输入
   */
  onQuizInput(e: WechatMiniprogram.Input) {
    this.setData({ quizInput: e.detail.value })
  },

  /**
   * 提交填空/拼写题作答
   */
  submitQuizAnswer() {
    if (this.data.quizAnswered) return
    const { quizInput, quizCorrectAnswer } = this.data
    if (!quizInput.trim()) {
      wx.showToast({ title: '请先输入答案', icon: 'none' })
      return
    }
    this.applyQuizResult(isAnswerCorrect(quizInput, quizCorrectAnswer))
  },

  /**
   * 记录测验结果：答对记「基本掌握」，答错记「疑难」，并同步 SRS 调度
   */
  async applyQuizResult(isCorrect: boolean) {
    this.setData({ quizAnswered: true, quizIsCorrect: isCorrect })
    await this.updateMastery(isCorrect ? 'learning' : 'difficult')
    setTimeout(() => {
      this.advanceQuiz()
    }, isCorrect ? 800 : 1800)
  },

  /**
   * 测验模式下推进到下一题
   */
  advanceQuiz() {
    const nextIndex = this.data.currentCardIndex + 1
    if (nextIndex >= this.data.sessionCards.length) {
      this.showStudyComplete()
      return
    }
    this.setData({ currentCardIndex: nextIndex })
    this.prepareQuestion()
  },

  /**
   * 开始学习计时（实时显示 + 每30秒自动保存）
   */
  startStudyTimer() {
    const now = Date.now()
    this.lastSaveTime = now
    this.sessionSeconds = 0

    this.setData({
      elapsedSeconds: 0,
      timerDisplay: '00:00'
    })

    // 每秒更新显示
    this.timerInterval = setInterval(() => {
      const elapsed = this.sessionSeconds + Math.floor((Date.now() - this.lastSaveTime) / 1000)
      this.setData({
        elapsedSeconds: elapsed,
        timerDisplay: this.formatTimerDisplay(elapsed)
      })
    }, 1000)

    // 每15秒自动保存增量
    this.saveInterval = setInterval(() => {
      const now2 = Date.now()
      const delta = Math.floor((now2 - this.lastSaveTime) / 1000)
      if (delta >= 5) {
        this.sessionSeconds += delta
        this.lastSaveTime = now2
        this.saveStudyRecord(delta)
      }
    }, 15000)
  },

  /** 清除所有计时器 */
  clearStudyIntervals() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
    if (this.saveInterval) {
      clearInterval(this.saveInterval)
      this.saveInterval = null
    }
  },

  /** 格式化秒数为 HH:MM:SS 或 MM:SS */
  formatTimerDisplay(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  },

  /**
   * 退出学习模式
   */
  exitStudy() {
    wx.showModal({
      title: '退出学习',
      content: '确定要退出学习模式吗？',
      success: (res) => {
        if (res.confirm) {
          this.stopStudyTimer()
          wx.navigateBack()
        }
      }
    })
  },

  /**
   * 停止学习计时并保存
   */
  async stopStudyTimer() {
    this.clearStudyIntervals()
    // 保存最后一段增量，同步到云端
    const delta = Math.floor((Date.now() - this.lastSaveTime) / 1000)
    if (delta >= 5) {
      await this.saveStudyRecord(delta, true)
    }
    this.sessionSeconds = 0
    this.lastSaveTime = 0
  },

  /**
   * 保存学习时长（本地运算 + 可选云端同步）
   * @param duration 本次学习秒数
   * @param syncToCloud 是否同步到云端（仅退出学习时同步）
   */
  async saveStudyRecord(duration: number, syncToCloud: boolean = false) {
    if (duration < 5) {
      console.log('[CardDetail] 学习时长太短，不保存')
      return
    }

    // 1. 本地运算：写入每日学习时长
    const today = new Date().toISOString().split('T')[0]
    addDailyStudyDuration(today, this.data.groupId, duration)

    // 2. 保存个体学习记录到本地（供统计页离线回退和备份使用）
    try {
      await studyRecordCollection.add({
        data: {
          recordId: generateId(),
          userId: app.globalData.userInfo?.username || 'local',
          groupId: this.data.groupId,
          studyDuration: duration,
          studyDate: new Date(),
          updateTime: Date.now()
        }
      })
    } catch (err: any) {
      console.warn('[CardDetail] 保存本地学习记录失败', err)
    }

    // 3. 更新界面显示
    const newTotal = this.data.todayStats.studiedTime + duration
    this.setData({
      'todayStats.studiedTime': newTotal,
      formattedStudiedTime: this.formatTime(newTotal)
    })

    // 4. 同步到云端（仅在退出学习时）
    if (syncToCloud) {
      const username = app.globalData.userInfo?.username
      if (!username) {
        console.warn('[CardDetail] 未登录，跳过云端同步')
        return
      }
      try {
        const { result } = await wx.cloud.callFunction({
          name: 'study_sync',
          data: {
            action: 'syncDaily',
            username,
            date: today,
            groupId: this.data.groupId,
            duration
          }
        })
        const res = result as { success: boolean }
        if (res.success) {
          console.log('[CardDetail] 云端同步成功', duration, '秒')
        } else {
          console.warn('[CardDetail] 云端同步失败', res)
        }
      } catch (err: any) {
        console.error('[CardDetail] 云端同步失败', err)
      }
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
    if (this.data.currentCardIndex < this.data.sessionCards.length - 1 && !this.data.cardAnim) {
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
    } else if (this.data.currentCardIndex === this.data.sessionCards.length - 1) {
      this.showStudyComplete()
    }
  },

  /**
   * 显示学习/测验完成提示
   */
  showStudyComplete() {
    const { isQuiz, sessionCards } = this.data
    const title = isQuiz ? '📝 测验完成' : '🎉 学习完成'
    const content = isQuiz
      ? `已完成 ${sessionCards.length} 张卡牌的测验！`
      : `已完成 ${sessionCards.length} 张卡牌的学习！`

    wx.showModal({
      title,
      content,
      showCancel: false,
      confirmText: '返回',
      success: () => {
        this.stopStudyTimer()
        wx.navigateBack()
      }
    })
  },

  /**
   * 翻牌
   */
  flipCard() {
    if (this.data.cardAnim) return
    
    this.setData({
      isFlipped: !this.data.isFlipped
    })
    
    if (this.data.isFlipped) {
      wx.vibrateShort({
        type: 'light'
      })
    }
  },

  /**
   * 设置掌握程度
   */
  async setMastery(e: WechatMiniprogram.TouchEvent) {
    const status = e.currentTarget.dataset.status as MasteryStatus
    await this.updateMastery(status)
  },

  /**
   * 设置掌握程度并翻到下一张
   */
  async setMasteryAndNext(e: WechatMiniprogram.TouchEvent) {
    const status = e.currentTarget.dataset.status as MasteryStatus
    await this.updateMastery(status)
    this.appendRelearnCard(status)
    this.nextCard()
  },

  /**
   * 更新掌握程度：持久化 status/reviewCount，并按 SRS 计算下次复习时间
   */
  async updateMastery(status: MasteryStatus) {
    const index = this.data.currentCardIndex
    const card = this.data.sessionCards[index]
    if (!card) return

    const nextSrs = applyMastery(card, status, todayKey())
    const nextReviewCount = (card.reviewCount || 0) + 1

    try {
      await cardCollection.doc(card.cardId).update({
        data: {
          status: status,
          reviewCount: nextReviewCount,
          srs: nextSrs
        }
      })

      // 同步会话队列与全量列表中的同一张卡（不可变：整体替换字段）
      const patch: Record<string, any> = {
        [`sessionCards[${index}].status`]: status,
        [`sessionCards[${index}].reviewCount`]: nextReviewCount,
        [`sessionCards[${index}].srs`]: nextSrs
      }
      const listIndex = this.data.cards.findIndex(c => c.cardId === card.cardId)
      if (listIndex !== -1) {
        patch[`cards[${listIndex}].status`] = status
        patch[`cards[${listIndex}].reviewCount`] = nextReviewCount
        patch[`cards[${listIndex}].srs`] = nextSrs
      }
      this.setData(patch)

      this.calculateStats()

      console.log('[CardDetail] 更新掌握程度', card.cardId, status, '下次复习', nextSrs.nextReviewDate)
    } catch (err: any) {
      console.error('[CardDetail] 更新掌握程度失败', err)
      showErrorToast(err)
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
    } catch (err: any) {
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
      if (!card) {
        wx.hideLoading()
        wx.showToast({ title: '未找到该卡片', icon: 'none' })
        return
      }
      if (card.cardId) {
        await cardCollection.doc(card.cardId).update({
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
    } catch (err: any) {
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
      if (!card) {
        wx.hideLoading()
        wx.showToast({ title: '未找到该卡片', icon: 'none' })
        return
      }
      if (card.cardId) {
        await cardCollection.doc(card.cardId).remove()
        
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        })
        
        this.loadCards()
        this.calculateStats()
      }
    } catch (err: any) {
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
        if (favorite && favorite.favoriteId) {
          await favoriteCollection.doc(favorite.favoriteId).remove()
          // 只有删除成功后，才更新本地状态
          const newFavoriteCardIds = this.data.favoriteCardIds.filter(id => id !== cardid)
          this.setData({
            favoriteCardIds: newFavoriteCardIds
          })
        } else {
          // 本地找不到收藏记录，触发重新加载
          await this.loadFavorites()
          return
        }

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
    } catch (err: any) {
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
    const groupId = this.data.groupId
    if (!groupId) {
      wx.showToast({ title: '卡牌组ID无效', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '删除中...' })
      await deleteCardGroup(groupId)

      wx.showToast({
        title: '删除成功',
        icon: 'success'
      })

      console.log('[CardDetail] 删除卡牌组成功', groupId)

      setTimeout(() => {
        wx.navigateBack()
      }, 1000)
    } catch (err: any) {
      console.error('[CardDetail] 删除卡牌组失败', err)
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 分享卡牌组（小程序消息卡片）
   * 注：实际卡牌数据分享请使用「文件分享」方式
   */
  onShareAppMessage() {
    const { title, totalCards } = this.data
    return {
      title: `${title} - ${totalCards}张卡牌`,
      path: `/pages/study/study`
    }
  },

  onShareTimeline() {
    return {
      title: `${this.data.title} - ${this.data.totalCards}张卡牌`
    }
  },

  /**
   * 导出卡牌组：选择 JSON 或 CSV 格式
   */
  exportCardGroup() {
    const { cards } = this.data
    if (cards.length === 0) {
      wx.showToast({
        title: '暂无卡牌可导出',
        icon: 'none'
      })
      return
    }
    wx.showActionSheet({
      itemList: ['导出为 JSON 文件', '导出为 CSV 文件'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.exportAsJson()
        } else {
          this.exportAsCsv()
        }
      }
    })
  },

  exportAsJson() {
    const { title, description, cards } = this.data

    if (cards.length === 0) {
      wx.showToast({
        title: '暂无卡牌可分享',
        icon: 'none'
      })
      return
    }

    const exportTime = new Date().toISOString()

    const exportData = {
      schemaVersion: '2.0',
      appVersion: '1.0.0',
      exportTime,
      exporter: {
        nickName: app.globalData.userInfo?.nickName || ''
      },
      summary: {
        cardCount: cards.length
      },
      group: {
        title,
        description: description || '',
        createTime: exportTime,
        updateTime: exportTime
      },
      cards: cards.map(c => ({
        front: c.front,
        back: c.back,
        createTime: c.createTime instanceof Date
          ? c.createTime.toISOString()
          : (typeof c.createTime === 'string' ? c.createTime : exportTime),
        status: c.status || 'new',
        reviewCount: c.reviewCount || 0
      }))
    }

    const jsonStr = JSON.stringify(exportData, null, 2)
    const fileName = `${title || '卡牌组'}.json`
    const fs = wx.getFileSystemManager()
    const tmpPath = `${wx.env.USER_DATA_PATH}/${fileName}`

    try {
      fs.writeFileSync(tmpPath, jsonStr, 'utf8')
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
    } catch (err: any) {
      console.error('[CardDetail] 写入文件失败', err)
      wx.showToast({
        title: '分享失败',
        icon: 'none'
      })
    }
  },

  /**
   * 导出为 CSV 文件（带 BOM，便于 Excel 正确识别 UTF-8）
   */
  exportAsCsv() {
    const { title, cards } = this.data
    const csv = buildCardsCsv(cards.map(item => ({ front: item.front as string, back: item.back as string })))
    const fileName = `${title || '卡牌组'}.csv`
    const fs = wx.getFileSystemManager()
    const tmpPath = `${wx.env.USER_DATA_PATH}/${fileName}`

    try {
      fs.writeFileSync(tmpPath, `\uFEFF${csv}`, 'utf8')
      // @ts-ignore shareFileMessage 类型声明缺失
      wx.shareFileMessage({
        filePath: tmpPath,
        fileName,
        success: () => {
          console.log('[CardDetail] 导出 CSV 成功')
        },
        fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
          console.error('[CardDetail] 导出 CSV 失败', err)
          wx.showToast({ title: '导出失败', icon: 'none' })
        }
      })
    } catch (err: any) {
      console.error('[CardDetail] 写入 CSV 失败', err)
      wx.showToast({ title: '导出失败', icon: 'none' })
    }
  },

  importCards() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: (res) => {
        const file = res.tempFiles[0]
        this.readImportFile(file.path, file.name)
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          console.error('[CardDetail] 选择文件失败', err)
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
          this.confirmImportCards(cards)
        },
        fail: (err) => {
          console.error('[CardDetail] 读取表格失败', err)
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
        console.error('[CardDetail] 读取文件失败', err)
        wx.showToast({
          title: '读取文件失败',
          icon: 'none'
        })
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
          wx.showToast({
            title: '剪贴板为空',
            icon: 'none'
          })
          return
        }
        this.processImportData(data)
      },
      fail: (err) => {
        console.error('[CardDetail] 读取剪贴板失败', err)
        wx.showToast({
          title: '读取剪贴板失败',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 处理导入数据：先按 JSON 解析，失败则按 CSV / 分隔符文本解析
   */
  processImportData(rawData: string) {
    const cardsToImport = parseImportCards(rawData)

    if (cardsToImport.length === 0) {
      wx.showToast({
        title: '无法识别文件格式',
        icon: 'none'
      })
      return
    }

    this.confirmImportCards(cardsToImport)
  },

  /**
   * 弹窗确认后导入到当前卡牌组
   */
  confirmImportCards(cardsToImport: { front: string; back: string }[]) {
    wx.showModal({
      title: '导入卡牌',
      content: `发现 ${cardsToImport.length} 张卡牌，确认导入到当前卡牌组？`,
      confirmColor: '#34d399',
      success: (modalRes) => {
        if (modalRes.confirm) {
          this.doImportCards(cardsToImport)
        }
      }
    })
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
    } catch (err: any) {
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
