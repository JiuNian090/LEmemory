import { IAppOption } from '../../utils/types'
import { syncManager } from '../../utils/sync'
import { enableShareMenu } from '../../utils/share'

const app = getApp<IAppOption>()

interface MinePageData {
  userInfo: any
}

Page<MinePageData, WechatMiniprogram.IAnyObject>({
  data: {
    userInfo: null
  },

  onLoad() {
    enableShareMenu()
    this.loadUserInfo()
  },

  onShow() {
    this.loadUserInfo()
  },

  /**
   * 加载用户信息
   */
  loadUserInfo() {
    try {
      const cachedUser = wx.getStorageSync('userInfo')
      if (cachedUser) {
        this.setData({
          userInfo: cachedUser
        })
      } else if (app.globalData.userInfo) {
        this.setData({
          userInfo: app.globalData.userInfo
        })
      }
    } catch (err) {
      console.error('[MinePage] 读取缓存失败', err)
    }
  },

  /**
   * 处理头部点击
   */
  handleHeaderClick() {
    if (this.data.userInfo) {
      wx.navigateTo({
        url: '/pages/settings/settings'
      })
    } else {
      wx.navigateTo({
        url: '/pages/login/login'
      })
    }
  },

  /**
   * 退出登录
   */
  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？本地数据将被清除，云端数据保留。',
      confirmColor: '#f56c6c',
      success: async (res) => {
        if (res.confirm) {
          await syncManager.onLogout()
          this.setData({ userInfo: null })

          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          })
        }
      }
    })
  },

  /**
   * 跳转到备份页面
   */
  goToBackup() {
    wx.navigateTo({
      url: '/pages/backup/backup'
    })
  },

  goToSettings() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    })
  },

  goToAbout() {
    wx.navigateTo({
      url: '/pages/about/about'
    })
  },

  openCustomerService() {
    (wx as any).openCustomerServiceChat({
      extInfo: { url: '' },
      success: () => {
        console.log('[Mine] 打开客服成功')
      },
      fail: (err: any) => {
        console.warn('[Mine] 打开客服失败', err)
        wx.showToast({
          title: '打开客服失败',
          icon: 'none'
        })
      }
    })
  },

  onShareAppMessage() {
    return {
      title: 'LEmemory - 我的',
      path: '/pages/mine/mine'
    }
  },

  onShareTimeline() {
    return {
      title: 'LEmemory - 我的'
    }
  }
})
