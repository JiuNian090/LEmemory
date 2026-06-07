import { IAppOption } from './utils/types'
import { tryAutoLogin } from './utils/auth'

App<IAppOption>({
  globalData: {
    userInfo: null
  },
  onLaunch() {
    // 尝试初始化云开发，但不强制要求
    if (wx.cloud) {
      try {
        wx.cloud.init({
          env: 'cloud1-d3g5crpd0b1f51b0f',
          traceUser: true,
        })
        console.log('[App] 云开发初始化成功')
      } catch (err) {
        console.log('[App] 云开发初始化失败，将使用本地存储模式', err)
        // 不显示错误弹窗，静默降级到本地存储
      }
    } else {
      console.log('[App] 当前版本不支持云开发，将使用本地存储模式')
    }

    // 尝试自动登录
    tryAutoLogin()
  },
})
