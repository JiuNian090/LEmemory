import { IAppOption } from '../../utils/types'
import { syncManager } from '../../utils/sync'

const app = getApp<IAppOption>()

interface SettingsPageData {
  userInfo: any
  nickName: string
  avatarUrl: string
  showNickNameModal: boolean
  showPasswordModal: boolean
  showSwitchSheet: boolean
  savedAccounts: any[]
  newNickName: string
  oldPassword: string
  newPassword: string
  confirmPassword: string
  loading: boolean
  showOldPassword: boolean
  showNewPassword: boolean
}

Page<SettingsPageData, WechatMiniprogram.IAnyObject>({
  data: {
    userInfo: null,
    nickName: '',
    avatarUrl: '',
    showNickNameModal: false,
    showPasswordModal: false,
    showSwitchSheet: false,
    savedAccounts: [],
    newNickName: '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    loading: false,
    showOldPassword: false,
    showNewPassword: false
  },

  onLoad() {
    this.loadUserInfo()
  },

  onShow() {
    this.loadUserInfo()
    this.loadSavedAccounts()
  },

  loadUserInfo() {
    try {
      const cachedUser = wx.getStorageSync('userInfo')
      if (cachedUser) {
        this.setData({
          userInfo: cachedUser,
          nickName: cachedUser.nickName || cachedUser.username || '',
          avatarUrl: cachedUser.avatarUrl || ''
        })
      } else if (app.globalData.userInfo) {
        const userInfo = app.globalData.userInfo
        this.setData({
          userInfo,
          nickName: userInfo.nickName || userInfo.username || '',
          avatarUrl: userInfo.avatarUrl || ''
        })
      }
    } catch (err) {
      console.error('[Settings] 读取用户信息失败', err)
    }
  },

  loadSavedAccounts() {
    try {
      const savedAccounts = wx.getStorageSync('savedAccounts') || []
      this.setData({ savedAccounts })
    } catch (err) {
      console.warn('[Settings] 加载已保存账号失败', err)
    }
  },

  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.updateAvatar(tempFilePath)
      }
    })
  },

  async updateAvatar(filePath: string) {
    this.setData({ loading: true })

    let cloudSuccess = false
    let avatarUrl = ''
    try {
      const cloudPath = `avatars/${this.data.userInfo._openid}_${Date.now()}.jpg`
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath,
        filePath
      })

      avatarUrl = uploadResult.fileID

      const { result } = await wx.cloud.callFunction({
        name: 'account_manager',
        data: {
          action: 'updateProfile',
          avatarUrl
        }
      })

      const updateResult = result as { success: boolean; error?: string; user?: any }
      if (updateResult.success && updateResult.user) {
        const serverUser = updateResult.user
        app.globalData.userInfo = serverUser
        wx.setStorageSync('userInfo', serverUser)
        this.setData({
          userInfo: serverUser,
          avatarUrl: serverUser.avatarUrl || ''
        })
        wx.showToast({ title: '头像更新成功', icon: 'success' })
        cloudSuccess = true
      } else {
        console.warn('[Settings] 云函数返回失败，降级本地保存', updateResult.error)
      }
    } catch (err) {
      console.warn('[Settings] 头像上传异常，降级本地保存', err)
    }

    if (!cloudSuccess && avatarUrl) {
      const localUser = {
        ...this.data.userInfo,
        avatarUrl
      }
      app.globalData.userInfo = localUser
      wx.setStorageSync('userInfo', localUser)
      this.setData({
        userInfo: localUser,
        avatarUrl
      })
      wx.showToast({ title: '头像已保存（本地）', icon: 'success' })
    } else if (!cloudSuccess) {
      wx.showToast({ title: '头像更新失败', icon: 'none' })
    }

    this.setData({ loading: false })
  },

  showNickNameEdit() {
    this.setData({
      showNickNameModal: true,
      newNickName: this.data.nickName
    })
  },

  hideNickNameModal() {
    this.setData({ showNickNameModal: false })
  },

  onNickNameInput(e: WechatMiniprogram.Input) {
    this.setData({ newNickName: e.detail.value })
  },

  async saveNickName() {
    const { newNickName } = this.data
    if (!newNickName.trim()) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' })
      return
    }
    if (newNickName.length > 20) {
      wx.showToast({ title: '昵称最多20个字符', icon: 'none' })
      return
    }

    const trimmedName = newNickName.trim()
    this.setData({ loading: true })

    let cloudSuccess = false
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'account_manager',
        data: {
          action: 'updateProfile',
          nickName: trimmedName
        }
      })

      const updateResult = result as { success: boolean; error?: string; user?: any }
      if (updateResult.success && updateResult.user) {
        const serverUser = updateResult.user
        app.globalData.userInfo = serverUser
        wx.setStorageSync('userInfo', serverUser)
        this.setData({
          userInfo: serverUser,
          nickName: serverUser.nickName || '',
          showNickNameModal: false
        })
        wx.showToast({ title: '昵称修改成功', icon: 'success' })
        cloudSuccess = true
      } else {
        console.warn('[Settings] 云函数返回失败，降级本地保存', updateResult.error)
      }
    } catch (err) {
      console.warn('[Settings] 云函数调用异常，降级本地保存', err)
    }

    if (!cloudSuccess) {
      const localUser = {
        ...this.data.userInfo,
        nickName: trimmedName
      }
      app.globalData.userInfo = localUser
      wx.setStorageSync('userInfo', localUser)
      this.setData({
        userInfo: localUser,
        nickName: trimmedName,
        showNickNameModal: false
      })
      wx.showToast({ title: '昵称已保存（本地）', icon: 'success' })
    }

    this.setData({ loading: false })
  },

  showPasswordEdit() {
    this.setData({
      showPasswordModal: true,
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
  },

  hidePasswordModal() {
    this.setData({ showPasswordModal: false })
  },

  onOldPasswordInput(e: WechatMiniprogram.Input) {
    this.setData({ oldPassword: e.detail.value })
  },

  onNewPasswordInput(e: WechatMiniprogram.Input) {
    this.setData({ newPassword: e.detail.value })
  },

  onConfirmPasswordInput(e: WechatMiniprogram.Input) {
    this.setData({ confirmPassword: e.detail.value })
  },

  toggleOldPassword() {
    this.setData({ showOldPassword: !this.data.showOldPassword })
  },

  toggleNewPassword() {
    this.setData({ showNewPassword: !this.data.showNewPassword })
  },

  showSwitchAccount() {
    this.loadSavedAccounts()
    this.setData({ showSwitchSheet: true })
  },

  hideSwitchSheet() {
    this.setData({ showSwitchSheet: false })
  },

  async switchToAccount(e: any) {
    const { username, password } = e.currentTarget.dataset
    if (!username || !password) return

    this.setData({ showSwitchSheet: false })
    wx.showToast({ title: '正在切换...', icon: 'none', duration: 800 })

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'account_manager',
        data: {
          action: 'login',
          username,
          password
        }
      })

      const loginResult = result as { success: boolean; error?: string; user?: any }
      if (loginResult.success && loginResult.user) {
        const serverUser = loginResult.user
        app.globalData.userInfo = serverUser
        wx.setStorageSync('userInfo', serverUser)
        this.setData({
          userInfo: serverUser,
          nickName: serverUser.nickName || '',
          avatarUrl: serverUser.avatarUrl || ''
        })
        this.updateSavedAccountTimestamp(username, serverUser)
        wx.showToast({ title: '切换成功', icon: 'success' })
      } else {
        wx.showToast({ title: loginResult.error || '切换失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[Settings] 切换账号失败', err)
      wx.showToast({ title: '切换失败，请稍后重试', icon: 'none' })
    }
  },

  updateSavedAccountTimestamp(username: string, user: any) {
    try {
      const savedAccounts = wx.getStorageSync('savedAccounts') || []
      const idx = savedAccounts.findIndex((a: any) => a.username === username)
      if (idx >= 0) {
        savedAccounts[idx].lastLoginTime = Date.now()
        savedAccounts[idx].nickName = user.nickName || savedAccounts[idx].nickName
        savedAccounts[idx].avatarUrl = user.avatarUrl || savedAccounts[idx].avatarUrl
        savedAccounts.sort((a: any, b: any) => b.lastLoginTime - a.lastLoginTime)
        wx.setStorageSync('savedAccounts', savedAccounts)
        this.setData({ savedAccounts })
      }
    } catch (err) {
      console.warn('[Settings] 更新账号时间戳失败', err)
    }
  },

  async confirmSwitchAccount() {
    this.setData({ showSwitchSheet: false })
    await syncManager.onLogout()
    wx.reLaunch({
      url: '/pages/login/login?action=new'
    })
  },

  async savePassword() {
    const { oldPassword, newPassword, confirmPassword } = this.data

    if (!oldPassword.trim()) {
      wx.showToast({ title: '请输入当前密码', icon: 'none' })
      return
    }
    if (!newPassword.trim()) {
      wx.showToast({ title: '请输入新密码', icon: 'none' })
      return
    }
    if (newPassword.length < 6) {
      wx.showToast({ title: '新密码至少6个字符', icon: 'none' })
      return
    }
    if (newPassword !== confirmPassword) {
      wx.showToast({ title: '两次密码不一致', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'account_manager',
        data: {
          action: 'updatePassword',
          oldPassword,
          newPassword
        }
      })

      const updateResult = result as { success: boolean; error?: string; passwordVersion?: number }
      if (updateResult.success) {
        this.setData({ showPasswordModal: false })
        wx.showToast({
          title: '密码修改成功，请重新登录',
          icon: 'success',
          duration: 2000
        })

        setTimeout(() => {
          app.globalData.userInfo = null
          try {
            wx.removeStorageSync('userInfo')
            wx.removeStorageSync('rememberedAccount')
          } catch (err) {
            console.warn('[Settings] 清除缓存失败', err)
          }
          wx.reLaunch({
            url: '/pages/login/login'
          })
        }, 2000)
      } else {
        wx.showToast({ title: updateResult.error || '修改失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[Settings] 修改密码失败', err)
      wx.showToast({ title: '修改失败，请稍后重试', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
