/**
 * 分享工具函数
 * 统一管理各页面的分享配置
 */

export interface ShareConfig {
  title: string
  path?: string
  imageUrl?: string
}

/**
 * 在页面 onLoad 中调用，开启分享菜单（好友+朋友圈）
 */
export function enableShareMenu() {
  wx.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  })
}

/**
 * 默认分享到好友
 */
export function defaultShareAppMessage(config: ShareConfig) {
  return {
    title: config.title,
    path: config.path || '/pages/study/study'
  }
}

/**
 * 默认分享到朋友圈
 */
export function defaultShareTimeline(config: ShareConfig) {
  const result: Record<string, any> = {
    title: config.title
  }
  if (config.imageUrl) {
    result.imageUrl = config.imageUrl
  }
  return result
}
