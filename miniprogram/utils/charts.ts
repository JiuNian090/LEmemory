// Canvas 2D 图表绘制工具
import type { TrendPoint, MonthlyPoint, HeatmapPoint, PieSlice } from './types'
import type { ThemeColors } from './theme-colors'
import { getThemeColors } from './theme-colors'
import { formatDurationShort } from './statistics-helpers'

const PADDING = { top: 20, right: 16, bottom: 30, left: 40 }

function getDPR(): number {
  try {
    return wx.getSystemInfoSync().pixelRatio
  } catch {
    return 2
  }
}

/**
 * 准备 Canvas 2D 上下文（处理 DPR）
 * 注意：使用 type=2d 时，旧式 setter 方法（setFillStyle 等）仍可工作
 */
function prepareCanvas(canvas: WechatMiniprogram.Canvas, width: number, height: number): {
  ctx: WechatMiniprogram.CanvasContext
  dpr: number
} {
  const dpr = getDPR()
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d') as WechatMiniprogram.CanvasContext
  ctx.scale(dpr, dpr)
  return { ctx, dpr }
}

function drawEmptyState(ctx: WechatMiniprogram.CanvasContext, w: number, h: number, theme: ThemeColors, text: string): void {
  ctx.setFillStyle(theme.textTertiary)
  ctx.setFontSize(12)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(text, w / 2, h / 2)
  ctx.draw()
}

/**
 * 绘制折线图（趋势）
 */
export function drawLineChart(
  canvas: WechatMiniprogram.Canvas,
  data: TrendPoint[],
  width: number,
  height: number,
  theme: ThemeColors = getThemeColors()
): void {
  const dpr = getDPR()
  const cssWidth = width / dpr
  const cssHeight = height / dpr
  const { ctx } = prepareCanvas(canvas, width, height)

  ctx.clearRect(0, 0, cssWidth, cssHeight)

  if (data.length === 0) {
    drawEmptyState(ctx, cssWidth, cssHeight, theme, '暂无趋势数据')
    return
  }

  const plotW = cssWidth - PADDING.left - PADDING.right
  const plotH = cssHeight - PADDING.top - PADDING.bottom

  // 计算 Y 轴范围
  const maxVal = Math.max(...data.map(d => d.duration), 1)
  const yMax = maxVal * 1.2
  const yMin = 0

  // 绘制网格线
  ctx.setStrokeStyle(theme.grid)
  ctx.setLineWidth(1)
  for (let i = 0; i <= 4; i++) {
    const y = PADDING.top + (plotH / 4) * i
    ctx.beginPath()
    ctx.moveTo(PADDING.left, y)
    ctx.lineTo(PADDING.left + plotW, y)
    ctx.stroke()
  }

  // 绘制 Y 轴标签
  ctx.setFillStyle(theme.textTertiary)
  ctx.setFontSize(10)
  ctx.setTextAlign('right')
  ctx.setTextBaseline('middle')
  ctx.fillText(formatDurationShort(yMax), PADDING.left - 4, PADDING.top)
  ctx.fillText(formatDurationShort(yMin), PADDING.left - 4, PADDING.top + plotH)

  // 计算点坐标
  const points = data.map((d, i) => {
    const x = data.length === 1
      ? PADDING.left + plotW / 2
      : PADDING.left + (plotW / (data.length - 1)) * i
    const y = PADDING.top + plotH - (d.duration / yMax) * plotH
    return { x, y, data: d }
  })

  // 绘制渐变填充
  if (points.length > 1) {
    const grad = ctx.createLinearGradient(0, PADDING.top, 0, PADDING.top + plotH)
    grad.addColorStop(0, theme.primaryAlpha30)
    grad.addColorStop(1, theme.primaryAlpha10)
    ctx.setFillStyle(grad)
    ctx.beginPath()
    ctx.moveTo(points[0].x, PADDING.top + plotH)
    points.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.lineTo(points[points.length - 1].x, PADDING.top + plotH)
    ctx.closePath()
    ctx.fill()
  }

  // 绘制折线
  ctx.setStrokeStyle(theme.primary)
  ctx.setLineWidth(2)
  ctx.setLineJoin('round')
  ctx.beginPath()
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  })
  ctx.stroke()

  // 绘制数据点
  ctx.setFillStyle(theme.primary)
  points.forEach(p => {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
    ctx.fill()
  })

  // 绘制 X 轴标签
  ctx.setFillStyle(theme.textTertiary)
  ctx.setFontSize(10)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  const labelStep = Math.max(1, Math.floor(data.length / 7))
  points.forEach((p, i) => {
    if (i % labelStep === 0 || i === points.length - 1) {
      ctx.fillText(data[i].label, p.x, PADDING.top + plotH + 6)
    }
  })

  ctx.draw()
}

/**
 * 绘制热力图（GitHub 风格）
 */
export function drawHeatmap(
  canvas: WechatMiniprogram.Canvas,
  data: HeatmapPoint[],
  width: number,
  height: number,
  year: number,
  theme: ThemeColors = getThemeColors()
): void {
  const dpr = getDPR()
  const cssWidth = width / dpr
  const cssHeight = height / dpr
  const { ctx } = prepareCanvas(canvas, width, height)
  ctx.clearRect(0, 0, cssWidth, cssHeight)

  // 参数
  const cellSize = 10
  const cellGap = 2
  const totalCellSize = cellSize + cellGap
  const leftPad = 30
  const topPad = 20
  const weeksInYear = 53
  const daysInWeek = 7

  if (data.length === 0) {
    drawEmptyState(ctx, cssWidth, cssHeight, theme, '暂无热力数据')
    return
  }

  const dataMap = new Map(data.map(d => [d.date, d]))

  // 计算颜色函数
  const colorForLevel = (level: 0 | 1 | 2 | 3 | 4): string => {
    if (level === 0) return theme.grid
    if (level === 1) return theme.primaryAlpha10
    if (level === 2) return theme.primaryAlpha30
    if (level === 3) return theme.primaryAlpha50
    return theme.primary
  }

  // 找一年中第一个日期是周几
  const firstDay = new Date(year, 0, 1)
  const firstDayWeekday = firstDay.getDay()
  const mondayBasedIndex = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1

  // 绘制网格
  for (let week = 0; week < weeksInYear; week++) {
    for (let day = 0; day < daysInWeek; day++) {
      const x = leftPad + week * totalCellSize
      const y = topPad + day * totalCellSize

      const dayOffset = week * 7 + day - mondayBasedIndex
      const cellDate = new Date(year, 0, 1 + dayOffset)
      const cellDateStr = `${cellDate.getFullYear()}-${(cellDate.getMonth() + 1).toString().padStart(2, '0')}-${cellDate.getDate().toString().padStart(2, '0')}`

      if (cellDate.getFullYear() !== year) continue

      const point = dataMap.get(cellDateStr)
      const level = point ? point.level : 0

      ctx.setFillStyle(colorForLevel(level))
      ctx.fillRect(x, y, cellSize, cellSize)
    }
  }

  // 月份标签
  ctx.setFillStyle(theme.textTertiary)
  ctx.setFontSize(9)
  ctx.setTextAlign('left')
  ctx.setTextBaseline('bottom')
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  for (let m = 0; m < 12; m++) {
    const firstOfMonth = new Date(year, m, 1)
    const dayDiff = Math.floor((firstOfMonth.getTime() - firstDay.getTime()) / 86400000)
    const weekIdx = Math.floor((dayDiff + mondayBasedIndex) / 7)
    const x = leftPad + weekIdx * totalCellSize
    if (x > cssWidth - 20) continue
    ctx.fillText(monthNames[m], x, topPad - 4)
  }

  // 星期标签
  ctx.setTextAlign('right')
  ctx.setTextBaseline('middle')
  const weekdayLabels = ['一', '三', '五']
  const weekdayIndices = [1, 3, 5]
  weekdayIndices.forEach((d, i) => {
    const y = topPad + d * totalCellSize + cellSize / 2
    ctx.fillText(weekdayLabels[i], leftPad - 4, y)
  })

  ctx.draw()
}

/**
 * 绘制月度柱状图
 */
export function drawMonthlyBarChart(
  canvas: WechatMiniprogram.Canvas,
  data: MonthlyPoint[],
  width: number,
  height: number,
  theme: ThemeColors = getThemeColors()
): void {
  const dpr = getDPR()
  const cssWidth = width / dpr
  const cssHeight = height / dpr
  const { ctx } = prepareCanvas(canvas, width, height)
  ctx.clearRect(0, 0, cssWidth, cssHeight)

  if (data.length === 0) {
    drawEmptyState(ctx, cssWidth, cssHeight, theme, '暂无月度数据')
    return
  }

  const plotW = cssWidth - PADDING.left - PADDING.right
  const plotH = cssHeight - PADDING.top - PADDING.bottom
  const maxVal = Math.max(...data.map(d => d.duration), 1)
  const yMax = maxVal * 1.2
  const barGap = 4
  const barWidth = Math.max(8, (plotW - barGap * (data.length - 1)) / data.length)

  // 网格
  ctx.setStrokeStyle(theme.grid)
  ctx.setLineWidth(1)
  for (let i = 0; i <= 4; i++) {
    const y = PADDING.top + (plotH / 4) * i
    ctx.beginPath()
    ctx.moveTo(PADDING.left, y)
    ctx.lineTo(PADDING.left + plotW, y)
    ctx.stroke()
  }

  // Y 轴标签
  ctx.setFillStyle(theme.textTertiary)
  ctx.setFontSize(10)
  ctx.setTextAlign('right')
  ctx.setTextBaseline('middle')
  ctx.fillText(formatDurationShort(yMax), PADDING.left - 4, PADDING.top)
  ctx.fillText('0', PADDING.left - 4, PADDING.top + plotH)

  // 柱子
  data.forEach((d, i) => {
    const x = PADDING.left + i * (barWidth + barGap)
    const barH = (d.duration / yMax) * plotH
    const y = PADDING.top + plotH - barH

    // 渐变
    const grad = ctx.createLinearGradient(0, y, 0, y + barH)
    grad.addColorStop(0, theme.primary)
    grad.addColorStop(1, theme.primaryAlpha50)
    ctx.setFillStyle(grad)
    ctx.fillRect(x, y, barWidth, barH)

    // 数值
    if (barH > 20) {
      ctx.setFillStyle(theme.textPrimary)
      ctx.setFontSize(9)
      ctx.setTextAlign('center')
      ctx.setTextBaseline('bottom')
      ctx.fillText(formatDurationShort(d.duration), x + barWidth / 2, y - 2)
    }

    // X 轴标签
    ctx.setFillStyle(theme.textTertiary)
    ctx.setTextAlign('center')
    ctx.setTextBaseline('top')
    const monthLabel = d.month.slice(5)
    ctx.fillText(monthLabel, x + barWidth / 2, PADDING.top + plotH + 6)
  })

  ctx.draw()
}

/**
 * 绘制饼图
 */
export function drawPieChart(
  canvas: WechatMiniprogram.Canvas,
  data: PieSlice[],
  width: number,
  height: number,
  theme: ThemeColors = getThemeColors()
): void {
  const dpr = getDPR()
  const cssWidth = width / dpr
  const cssHeight = height / dpr
  const { ctx } = prepareCanvas(canvas, width, height)
  ctx.clearRect(0, 0, cssWidth, cssHeight)

  if (data.length === 0) {
    drawEmptyState(ctx, cssWidth, cssHeight, theme, '暂无卡牌组数据')
    return
  }

  const cx = cssWidth * 0.35
  const cy = cssHeight / 2
  const radius = Math.min(cssWidth * 0.3, cssHeight * 0.4)
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) {
    drawEmptyState(ctx, cssWidth, cssHeight, theme, '暂无数据')
    return
  }

  // 绘制扇形
  let startAngle = -Math.PI / 2
  data.forEach((slice, i) => {
    const angle = (slice.value / total) * Math.PI * 2
    const endAngle = startAngle + angle

    ctx.setFillStyle(slice.color || theme.chartPalette[i % theme.chartPalette.length])
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, radius, startAngle, endAngle)
    ctx.closePath()
    ctx.fill()

    startAngle = endAngle
  })

  // 中心圆
  ctx.setFillStyle(theme.cardBg)
  ctx.beginPath()
  ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2)
  ctx.fill()

  // 中心文字
  ctx.setFillStyle(theme.textPrimary)
  ctx.setFontSize(12)
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText('总时长', cx, cy - 8)
  ctx.setFontSize(11)
  ctx.setFillStyle(theme.textSecondary)
  ctx.fillText(formatDurationShort(total), cx, cy + 8)

  // 图例
  const legendX = cssWidth * 0.65
  const legendY = 20
  const lineHeight = 20
  ctx.setFontSize(10)
  ctx.setTextAlign('left')
  ctx.setTextBaseline('middle')
  data.slice(0, 6).forEach((slice, i) => {
    const y = legendY + i * lineHeight
    const color = slice.color || theme.chartPalette[i % theme.chartPalette.length]
    ctx.setFillStyle(color)
    ctx.fillRect(legendX, y - 4, 8, 8)
    ctx.setFillStyle(theme.textPrimary)
    const label = slice.title.length > 6 ? slice.title.slice(0, 6) + '…' : slice.title
    ctx.fillText(`${label} ${Math.round(slice.percentage)}%`, legendX + 14, y)
  })

  ctx.draw()
}
