App<IAppOption>({
  globalData: {
    userInfo: null
  },
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloudbase-1gar7d7f967d8a60',
        traceUser: true,
      })
    }
  },
})
