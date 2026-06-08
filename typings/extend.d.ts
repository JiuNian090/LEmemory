/**
 * 微信小程序 API 类型扩展
 * 补充 miniprogram-api-typings 中缺失的新 API 类型声明
 */

declare namespace WechatMiniprogram {
  /** 窗口信息（wx.getWindowInfo 返回值） */
  interface WindowInfo {
    /** 设备像素比 */
    pixelRatio: number
    /** 屏幕宽度（物理像素） */
    screenWidth: number
    /** 屏幕高度（物理像素） */
    screenHeight: number
    /** 窗口宽度（CSS 像素） */
    windowWidth: number
    /** 窗口高度（CSS 像素） */
    windowHeight: number
    /** 状态栏高度 */
    statusBarHeight: number
    /** 安全区域 */
    safeArea?: SafeArea
  }

  /** 应用基础信息（wx.getAppBaseInfo 返回值） */
  interface AppBaseInfo {
    /** 客户端基础库版本 */
    SDKVersion: string
    /** 主题（深色模式状态） */
    theme: 'light' | 'dark'
    /** 语言 */
    language?: string
    /** 微信版本号 */
    version?: string
  }

  interface Wx {
    /**
     * 获取窗口信息
     * 最低基础库：2.20.1
     */
    getWindowInfo(): WindowInfo

    /**
     * 获取应用基础信息
     * 最低基础库：2.24.0
     */
    getAppBaseInfo(): AppBaseInfo
  }
}