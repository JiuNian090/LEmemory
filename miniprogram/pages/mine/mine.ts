import { userCollection } from '../../utils/db'

const app = getApp<IAppOption>()

interface MinePageData {
  userInfo: WechatMiniprogram.UserInfo | null
  canIUse: boolean
}

Page<MinePageData, WechatMiniprogram.IAnyObject, WechatMiniprogram.IAnyObject>({
  data: {
    userInfo: null,
    canIUse: wx.canIUse('button.open-type.getUserProfile')
  },

  onLoad() {
    this.loadUserInfo()
  },

  /**
   * 加载用户信息（先从缓存，再从全局数据）
   */
  loadUserInfo() {
    try {
      const cachedUser = wx.getStorageSync('userInfo')
      if (cachedUser) {
        this.setData({
          userInfo: cachedUser
        })
        return
      }
    } catch (err) {
      console.error('[MinePage] 读取缓存失败', err)
    }

    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo
      })
    }
  },

  /**
   * 获取用户信息并登录
   */
  getUserProfile() {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        console.log('[MinePage] 获取用户信息成功', res.userInfo)
        app.globalData.userInfo = res.userInfo
        this.setData({
          userInfo: res.userInfo
        })
        wx.setStorageSync('userInfo', res.userInfo)
        this.saveUserInfo(res.userInfo)
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        })
      },
      fail: (err) => {
        console.error('[MinePage] 获取用户信息失败', err)
        wx.showToast({
          title: '授权失败',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 保存用户信息到数据库
   */
  async saveUserInfo(userInfo: WechatMiniprogram.UserInfo) {
    try {
      wx.showLoading({
        title: '同步中...'
      })

      const { data } = await userCollection.get()
      
      if (data.length === 0) {
        await userCollection.add({
          data: {
            nickName: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl,
            createTime: new Date()
          }
        })
        console.log('[MinePage] 创建用户信息成功')
      } else {
        await userCollection.doc(data[0]._id).update({
          data: {
            nickName: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl
          }
        })
        console.log('[MinePage] 更新用户信息成功')
      }
    } catch (err) {
      console.error('[MinePage] 保存用户信息失败', err)
    } finally {
      wx.hideLoading()
    }
  }
})
