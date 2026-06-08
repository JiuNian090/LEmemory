import { changelogData, ChangelogItem } from '../../utils/changelog'
import { enableShareMenu } from '../../utils/share'

interface AboutPageData {
  appName: string
  appVersion: string
  appDesc: string
  changelog: ChangelogItem[]
}

Page<AboutPageData, WechatMiniprogram.IAnyObject>({
  data: {
    appName: 'LEmemory',
    appVersion: '1.0.0',
    appDesc: '智能记忆卡片，高效学习助手',
    changelog: changelogData
  },

  onLoad() {
    enableShareMenu()
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
