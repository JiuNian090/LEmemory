import { IAppOption } from '../../utils/types'

const app = getApp<IAppOption>()

interface SettingsPageData {
  userInfo: any
  nickName: string
  avatarUrl: string
  showNickNameModal: boolean
  showPasswordModal: boolean
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
    try {
      const cloudPath = `avatars/${this.data.userInfo._openid}_${Date.now()}.jpg`
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath,
        filePath
      })

      const avatarUrl = uploadResult.fileID

      const { result } = await wx.cloud.callFunction({
        name: 'account_manager',
        data: {
          action: 'updateProfile',
          avatarUrl
        }
      })

      const updateResult = result as { success: boolean; error?: string }
      if (updateResult.success) {
        const updatedUserInfo = { ...this.data.userInfo, avatarUrl }
        app.globalData.userInfo = updatedUserInfo
        wx.setStorageSync('userInfo', updatedUserInfo)
        this.setData({
          userInfo: updatedUserInfo,
          avatarUrl
        })
        wx.showToast({ title: '头像更新成功', icon: 'success' })
      } else {
        wx.showToast({ title: updateResult.error || '更新失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[Settings] 更新头像失败', err)
      wx.showToast({ title: '更新失败，请稍后重试', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
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

    this.setData({ loading: true })
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'account_manager',
        data: {
          action: 'updateProfile',
          nickName: newNickName.trim()
        }
      })

      const updateResult = result as { success: boolean; error?: string }
      if (updateResult.success) {
        const updatedUserInfo = { ...this.data.userInfo, nickName: newNickName.trim() }
        app.globalData.userInfo = updatedUserInfo
        wx.setStorageSync('userInfo', updatedUserInfo)
        this.setData({
          userInfo: updatedUserInfo,
          nickName: newNickName.trim(),
          showNickNameModal: false
        })
        wx.showToast({ title: '昵称修改成功', icon: 'success' })
      } else {
        wx.showToast({ title: updateResult.error || '修改失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[Settings] 修改昵称失败', err)
      wx.showToast({ title: '修改失败，请稍后重试', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
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

      const updateResult = result as { success: boolean; error?: string }
      if (updateResult.success) {
        this.setData({ showPasswordModal: false })
        wx.showToast({ title: '密码修改成功', icon: 'success' })
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
