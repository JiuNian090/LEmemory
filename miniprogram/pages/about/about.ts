import { changelogData, ChangelogItem } from '../../utils/changelog'
import { enableShareMenu } from '../../utils/share'
import type { IAppOption } from '../../utils/types'

interface AboutPageData {
  appName: string
  appVersion: string
  appDesc: string
  changelog: ChangelogItem[]
}

const app = getApp<IAppOption>()

Page<AboutPageData, WechatMiniprogram.IAnyObject>({
  data: {
    appName: 'LEmemory',
    appVersion: '1.2.5',
    appDesc: '智能记忆卡片，高效学习助手',
    changelog: changelogData
  },

  onLoad() {
    const version = app.globalData?.appVersion || '1.2.5'
    this.setData({ appVersion: version })

    try {
      enableShareMenu()
    } catch (err: any) {
      console.warn('[About] enableShareMenu failed:', err)
    }
  },

  onShareAppMessage() {
    return {
      title: 'LEmemory - 关于',
      path: '/pages/about/about'
    }
  },

  onShareTimeline() {
    return {
      title: 'LEmemory - 关于'
    }
  }
})
