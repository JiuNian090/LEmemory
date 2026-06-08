import { formatDuration } from '../../utils/time'
import { getThemeColors, onThemeChange } from '../../utils/theme-colors'
import {
  getPeriodRange,
  dailyDataToRecords
} from '../../utils/statistics-helpers'
import {
  drawLineChart,
  drawHeatmap,
  drawMonthlyBarChart,
  drawPieChart
} from '../../utils/charts'
import { computeStatistics } from '../../utils/statistics'
import type { PeriodType, StatisticsResult, PieSlice, StudyRecord } from '../../utils/types'
import { enableShareMenu } from '../../utils/share'
import type { IAppOption } from '../../utils/types'

const app = getApp<IAppOption>()

/** 获取设备像素比（带运行时降级） */
function getDPR(): number {
  try {
    return wx.getWindowInfo().pixelRatio
  } catch {
    return 2
  }
}

interface StatisticsPageData {
  startDate: string
  endDate: string
  activeQuickBtn: PeriodType | ''
  periodLabel: string
  formattedDuration: string
  changeDirection: 'up' | 'down' | 'flat' | ''
  changeText: string
  studyDays: number
  currentStreak: number
  achievementRate: number
  groupCount: number
  dailyGoalMinutes: number
  heatmapYear: number
  groupPieData: Array<{
    groupId: string
    title: string
    value: number
    formattedValue: string
    percentage: number
    color: string
  }>
}

const DEFAULT_DAILY_GOAL = 30
const GOAL_STORAGE_KEY = 'dailyGoalMinutes'

Page<StatisticsPageData, WechatMiniprogram.IAnyObject>({
  data: {
    startDate: '',
    endDate: '',
    activeQuickBtn: 'month',
    periodLabel: '月',
    formattedDuration: '0秒',
    changeDirection: 'flat',
    changeText: '—',
    studyDays: 0,
    currentStreak: 0,
    achievementRate: 0,
    groupCount: 0,
    dailyGoalMinutes: DEFAULT_DAILY_GOAL,
    heatmapYear: new Date().getFullYear(),
    groupPieData: []
  },

  onLoad() {
    enableShareMenu()
    const goal = this.loadGoalFromStorage()
    this.setData({ dailyGoalMinutes: goal })

    // 默认显示本月
    const range = getPeriodRange('month')
    this.setData({
      startDate: range.start,
      endDate: range.end
    })

    // 订阅主题变化
    this.unsubscribeTheme = onThemeChange(() => {
      this.drawAllCharts()
    })

    this.loadStatistics()
  },

  onShow() {
    // 每次显示轻量刷新（无 loading），入参无变化则跳过
    this.lastInput = null // 清除缓存以强制刷新
    this.loadStatistics(false)
  },

  onUnload() {
    if (this.unsubscribeTheme) {
      this.unsubscribeTheme()
    }
  },

  // 取消主题订阅（Page 内部属性）
  unsubscribeTheme: undefined as (() => void) | undefined,

  // 当前统计数据缓存
  currentResult: null as StatisticsResult | null,

  /** 缓存上次入参，无变化时跳过重算 */
  lastInput: null as { startDate: string; endDate: string; dailyGoalMinutes: number } | null,

  async loadStatistics(showLoading: boolean = false) {
    const { startDate, endDate, dailyGoalMinutes, activeQuickBtn } = this.data
    if (!startDate || !endDate) return

    // 入参无变化且已有结果，跳过重算
    const input = { startDate, endDate, dailyGoalMinutes }
    if (
      this.currentResult && 
      this.lastInput &&
      this.lastInput.startDate === input.startDate &&
      this.lastInput.endDate === input.endDate &&
      this.lastInput.dailyGoalMinutes === input.dailyGoalMinutes
    ) {
      return
    }
    this.lastInput = input

    try {
      if (showLoading) {
        wx.showLoading({ title: '计算中...' })
      }

      // 优先从云端拉取学习记录
      let cloudRecords: StudyRecord[] | undefined
      const username = app.globalData.userInfo?.username
      if (username) {
        cloudRecords = await this.fetchCloudRecords(startDate, endDate)
      }

      const data = computeStatistics(
        startDate,
        endDate,
        activeQuickBtn || 'custom',
        dailyGoalMinutes,
        cloudRecords  // 传入云端记录，未获取到时 fallback 到本地
      )

      this.currentResult = data

      // 注入饼图颜色
      const theme = getThemeColors()
      const groupPieData = data.groupPieData.map((s, i) => ({
        groupId: s.groupId,
        title: s.title,
        value: s.value,
        formattedValue: formatDuration(s.value),
        percentage: Math.round(s.percentage * 10) / 10,
        color: s.color || theme.chartPalette[i % theme.chartPalette.length]
      }))

      this.setData({
        formattedDuration: formatDuration(data.totalDuration),
        changeDirection: data.changeDirection,
        changeText: data.changeText,
        studyDays: data.studyDays,
        currentStreak: data.currentStreak,
        achievementRate: data.achievementRate,
        groupCount: data.groupCount,
        heatmapYear: new Date(data.startDate).getFullYear(),
        groupPieData
      })

      // 等下一帧绘制
      wx.nextTick(() => this.drawAllCharts())
    } catch (err) {
      console.error('[StatisticsPage] 计算失败', err)
      if (showLoading) {
        wx.showToast({ title: '计算失败', icon: 'none' })
      }
    } finally {
      if (showLoading) {
        wx.hideLoading()
      }
    }
  },

  drawAllCharts() {
    if (!this.currentResult) return
    this.drawTrendChart()
    this.drawHeatmapChart()
    this.drawMonthlyChart()
    this.drawPieChart()
  },

  drawTrendChart() {
    const result = this.currentResult
    if (!result) return
    const query = wx.createSelectorQuery()
    query.select('#trendChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvasInfo = res[0]
        if (!canvasInfo || !canvasInfo.node) return
        const canvas = canvasInfo.node as WechatMiniprogram.Canvas
        const dpr = getDPR()
        const width = (canvasInfo.width || 0) * dpr
        const height = (canvasInfo.height || 0) * dpr
        if (width === 0 || height === 0) return
        drawLineChart(canvas, result.trendData, width, height)
      })
  },

  drawHeatmapChart() {
    const result = this.currentResult
    if (!result) return
    const query = wx.createSelectorQuery()
    query.select('#heatmapChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvasInfo = res[0]
        if (!canvasInfo || !canvasInfo.node) return
        const canvas = canvasInfo.node as WechatMiniprogram.Canvas
        const dpr = getDPR()
        const width = (canvasInfo.width || 0) * dpr
        const height = (canvasInfo.height || 0) * dpr
        if (width === 0 || height === 0) return
        drawHeatmap(canvas, result.heatmapData, width, height, this.data.heatmapYear)
      })
  },

  drawMonthlyChart() {
    const result = this.currentResult
    if (!result) return
    const query = wx.createSelectorQuery()
    query.select('#monthlyChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvasInfo = res[0]
        if (!canvasInfo || !canvasInfo.node) return
        const canvas = canvasInfo.node as WechatMiniprogram.Canvas
        const dpr = getDPR()
        const width = (canvasInfo.width || 0) * dpr
        const height = (canvasInfo.height || 0) * dpr
        if (width === 0 || height === 0) return
        drawMonthlyBarChart(canvas, result.monthlyData, width, height)
      })
  },

  drawPieChart() {
    const query = wx.createSelectorQuery()
    query.select('#pieChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvasInfo = res[0]
        if (!canvasInfo || !canvasInfo.node) return
        const canvas = canvasInfo.node as WechatMiniprogram.Canvas
        const dpr = getDPR()
        const width = (canvasInfo.width || 0) * dpr
        const height = (canvasInfo.height || 0) * dpr
        if (width === 0 || height === 0) return
        // 直接使用 data.groupPieData（含已注入的颜色）
        const data = this.data.groupPieData.map(s => ({
          groupId: s.groupId,
          title: s.title,
          value: s.value,
          percentage: s.percentage,
          color: s.color
        } as PieSlice))
        drawPieChart(canvas, data, width, height)
      })
  },

  onQuickTap(e: WechatMiniprogram.TouchEvent) {
    const type = e.currentTarget.dataset.type as PeriodType
    const range = getPeriodRange(type)
    const labelMap: Record<PeriodType, string> = {
      week: '周', month: '月', year: '年', all: '全部', custom: '周期'
    }
    this.setData({
      startDate: range.start,
      endDate: range.end,
      activeQuickBtn: type,
      periodLabel: labelMap[type]
    })
    this.lastInput = null // 强制刷新
    this.loadStatistics(true)
  },

  onDateChange(e: WechatMiniprogram.TouchEvent) {
    const field = e.currentTarget.dataset.field as 'start' | 'end'
    const value = e.detail.value
    this.setData({
      [field]: value,
      activeQuickBtn: '',
      periodLabel: '周期'
    } as any)
    this.lastInput = null
    this.loadStatistics(true)
  },

  onSetGoalTap() {
    wx.showModal({
      title: '设置每日学习目标',
      editable: true,
      placeholderText: '请输入分钟数（1-480）',
      content: String(this.data.dailyGoalMinutes),
      success: (res) => {
        if (!res.confirm || !res.content) return
        const n = parseInt(res.content, 10)
        if (isNaN(n) || n < 1 || n > 480) {
          wx.showToast({ title: '请输入 1-480', icon: 'none' })
          return
        }
        this.saveGoalToStorage(n)
        this.setData({ dailyGoalMinutes: n })
        this.lastInput = null
        this.loadStatistics(true)
      }
    })
  },

  loadGoalFromStorage(): number {
    try {
      const v = wx.getStorageSync(GOAL_STORAGE_KEY)
      const n = parseInt(v, 10)
      if (!isNaN(n) && n > 0 && n <= 480) return n
    } catch {}
    return DEFAULT_DAILY_GOAL
  },

  saveGoalToStorage(minutes: number) {
    try {
      wx.setStorageSync(GOAL_STORAGE_KEY, minutes)
    } catch (err) {
      console.error('[StatisticsPage] 保存目标失败', err)
    }
  },

  /**
   * 从云端拉取每日学习数据（study_daily 聚合格式）
   */
  async fetchCloudRecords(startDate: string, endDate: string): Promise<StudyRecord[] | undefined> {
    const username = app.globalData.userInfo?.username
    if (!username) return

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'study_sync',
        data: {
          action: 'getDailyData',
          username,
          startDate,
          endDate
        }
      })
      const res = result as { success: boolean; data: any[] }
      if (res.success) {
        console.log('[StatisticsPage] 拉取云端每日数据', res.data.length, '条')
        return dailyDataToRecords(res.data, username)
      }
      console.warn('[StatisticsPage] 云端拉取失败，使用本地数据', res)
    } catch (err) {
      console.error('[StatisticsPage] 云端拉取异常，使用本地数据', err)
    }
    return undefined
  },

  // 图表触摸事件（占位）
  onChartTap() {},
  onHeatmapTap() {},

  onShareAppMessage() {
    return {
      title: 'LEmemory 学习统计',
      path: '/pages/statistics/statistics'
    }
  },

  onShareTimeline() {
    return {
      title: 'LEmemory 学习统计'
    }
  }
})
