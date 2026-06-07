// 主题色 token：与 app.wxss 中的 CSS 变量保持一致
// 用于 Canvas 图表绘制（Canvas 不支持 CSS 变量）

export interface ThemeColors {
  primary: string
  primaryDark: string
  primaryLight: string
  primaryAlpha10: string
  primaryAlpha30: string
  primaryAlpha50: string
  primaryAlpha70: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  border: string
  cardBg: string
  bg: string
  grid: string
  chartPalette: string[]
}

const LIGHT_THEME: ThemeColors = {
  primary: '#34d399',
  primaryDark: '#10b981',
  primaryLight: '#d1fae5',
  primaryAlpha10: 'rgba(52, 211, 153, 0.1)',
  primaryAlpha30: 'rgba(52, 211, 153, 0.3)',
  primaryAlpha50: 'rgba(52, 211, 153, 0.5)',
  primaryAlpha70: 'rgba(52, 211, 153, 0.7)',
  textPrimary: '#1a1a1a',
  textSecondary: '#666666',
  textTertiary: '#999999',
  border: '#e8e8e8',
  cardBg: '#ffffff',
  bg: '#f5f5f5',
  grid: 'rgba(0, 0, 0, 0.08)',
  chartPalette: ['#34d399', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#fb923c', '#22d3ee']
}

const DARK_THEME: ThemeColors = {
  primary: '#34d399',
  primaryDark: '#10b981',
  primaryLight: '#064e3b',
  primaryAlpha10: 'rgba(52, 211, 153, 0.15)',
  primaryAlpha30: 'rgba(52, 211, 153, 0.35)',
  primaryAlpha50: 'rgba(52, 211, 153, 0.55)',
  primaryAlpha70: 'rgba(52, 211, 153, 0.75)',
  textPrimary: '#e5e5e5',
  textSecondary: '#a3a3a3',
  textTertiary: '#737373',
  border: '#333333',
  cardBg: '#262626',
  bg: '#1a1a1a',
  grid: 'rgba(255, 255, 255, 0.1)',
  chartPalette: ['#34d399', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#fb923c', '#22d3ee']
}

let cachedTheme: 'light' | 'dark' | null = null

/**
 * 检测当前主题（深色/浅色）
 */
function detectTheme(): 'light' | 'dark' {
  try {
    const info = wx.getSystemInfoSync()
    return info.theme === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/**
 * 获取当前主题色 token
 */
export function getThemeColors(): ThemeColors {
  if (!cachedTheme) {
    cachedTheme = detectTheme()
  }
  return cachedTheme === 'dark' ? DARK_THEME : LIGHT_THEME
}

/**
 * 订阅主题变化，返回取消订阅函数
 */
export function onThemeChange(callback: () => void): () => void {
  try {
    const handler = () => {
      const newTheme = detectTheme()
      if (newTheme !== cachedTheme) {
        cachedTheme = newTheme
        callback()
      }
    }
    wx.onThemeChange(handler)
    return () => wx.offThemeChange(handler)
  } catch {
    return () => {}
  }
}
