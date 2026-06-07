import { formatDuration } from '../../utils/time'
import { getThemeColors, onThemeChange } from '../../utils/theme-colors'
import {
  getPeriodRange
} from '../../utils/statistics-helpers'
import {
  drawLineChart,
  drawHeatmap,
  drawMonthlyBarChart,
  drawPieChart
} from '../../utils/charts'
import type { PeriodType, StatisticsResult, PieSlice } from '../../utils/types'

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
    // 每次显示都刷新一次（响应新增学习记录）
    this.loadStatistics()
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

  async loadStatistics() {
    const { startDate, endDate, dailyGoalMinutes, activeQuickBtn } = this.data
    if (!startDate || !endDate) return

    try {
      wx.showLoading({ title: '加载中...' })

      const res = await wx.cloud.callFunction({
        name: 'statistics_get',
        data: {
          startDate,
          endDate,
          periodType: activeQuickBtn || 'custom',
          dailyGoalMinutes
        }
      })

      const result = (res as any).result
      if (!result || !result.success) {
        throw new Error(result?.error || '云函数返回失败')
      }

      const data = result.data as StatisticsResult
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
      console.error('[StatisticsPage] 加载失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
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
        const dpr = wx.getSystemInfoSync().pixelRatio
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
        const dpr = wx.getSystemInfoSync().pixelRatio
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
        const dpr = wx.getSystemInfoSync().pixelRatio
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
        const dpr = wx.getSystemInfoSync().pixelRatio
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
    this.loadStatistics()
  },

  onDateChange(e: WechatMiniprogram.TouchEvent) {
    const field = e.currentTarget.dataset.field as 'start' | 'end'
    const value = e.detail.value
    this.setData({
      [field]: value,
      activeQuickBtn: '',
      periodLabel: '周期'
    } as any)
    this.loadStatistics()
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
        this.loadStatistics()
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

  // 图表触摸事件（占位）
  onChartTap() {},
  onHeatmapTap() {}
})
