import { IAppOption } from '../../utils/types'
import { syncManager } from '../../utils/sync'
import { enableShareMenu } from '../../utils/share'
import { syncUserProfile, getBestAvatarUrl } from '../../utils/userSync'

const app = getApp<IAppOption>()

interface MinePageData {
  userInfo: any
  /** 当前最佳头像显示路径 */
  avatarDisplayUrl: string
}

Page<MinePageData, WechatMiniprogram.IAnyObject>({
  data: {
    userInfo: null,
    avatarDisplayUrl: '/images/me.png'
  },

  onLoad() {
    enableShareMenu()
    this.loadUserInfo()
  },

  onShow() {
    this.loadUserInfo()
    // 页面显示时从云端同步用户资料（头像、昵称等多端同步）
    syncUserProfile().then((changed) => {
      if (changed) {
        this.loadUserInfo()
      }
    })
  },

  /**
   * 加载用户信息并计算最佳头像路径
   */
  loadUserInfo() {
    try {
      const cachedUser = wx.getStorageSync('userInfo')
      const userInfo = cachedUser || app.globalData.userInfo || null
      if (userInfo) {
        this.setData({
          userInfo,
          avatarDisplayUrl: getBestAvatarUrl(userInfo)
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
  },

  /**
   * 生成小程序分享链接，复制到剪贴板
   */
  async copyShareLink() {
    wx.showLoading({ title: '生成分享链接...' })
    try {
      const res: any = await wx.cloud.callFunction({
        name: 'share_link',
        data: {}
      })
      if (!res.result.success) {
        wx.showToast({ title: '当前环境不支持，请使用右上角转发', icon: 'none' })
        return
      }
      const { urlLink } = res.result
      await wx.setClipboardData({ data: urlLink })
      wx.showToast({ title: '小程序链接已复制', icon: 'success' })
    } catch (err) {
      console.error('[Mine] 生成分享链接失败', err)
      wx.showToast({ title: '生成失败，请使用右上角转发', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})
