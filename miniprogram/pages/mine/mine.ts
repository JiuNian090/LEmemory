import { IAppOption } from '../../utils/types'

const app = getApp<IAppOption>()

interface MinePageData {
  userInfo: any
}

Page<MinePageData, WechatMiniprogram.IAnyObject>({
  data: {
    userInfo: null
  },

  onLoad() {
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
      content: '确定要退出当前账号吗？',
      confirmColor: '#f87171',
      success: (res) => {
        if (res.confirm) {
          // 清除用户信息
          app.globalData.userInfo = null
          this.setData({
            userInfo: null
          })
          
          // 保留记住密码的信息，只清除用户登录状态
          try {
            wx.removeStorageSync('userInfo')
          } catch (err) {
            console.error('[MinePage] 清除用户信息失败', err)
          }

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
  }
})
