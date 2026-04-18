const app = getApp<IAppOption>()

Page({
  data: {
    userInfo: null,
    canIUse: wx.canIUse('button.open-type.getUserProfile')
  },

  onLoad() {
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo
      })
    }
  },

  getUserProfile() {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        app.globalData.userInfo = res.userInfo
        this.setData({
          userInfo: res.userInfo
        })
        this.saveUserInfo(res.userInfo)
      }
    })
  },

  async saveUserInfo(userInfo: WechatMiniprogram.UserInfo) {
    const { userCollection, generateId } = require('../../utils/db')
    try {
      const { data } = await userCollection.get()
      if (data.length === 0) {
        await userCollection.add({
          data: {
            nickName: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl,
            createTime: new Date()
          }
        })
      }
    } catch (err) {
      console.error('保存用户信息失败', err)
    }
  }
})
