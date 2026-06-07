import { syncManager } from '../../utils/sync'
import { IAppOption } from '../../utils/types'

const app = getApp<IAppOption>()

interface LoginPageData {
  mode: 'login' | 'register'
  userInfo: any
  loginAction: string
  loginForm: {
    username: string
    password: string
    rememberPassword: boolean
  }
  registerForm: {
    username: string
    password: string
    confirmPassword: string
    nickName: string
    avatarUrl: string
  }
  loading: boolean
  showPassword: boolean
}

Page<LoginPageData, WechatMiniprogram.IAnyObject>({
  data: {
    mode: 'login',
    userInfo: null,
    loginAction: '',
    loginForm: {
      username: '',
      password: '',
      rememberPassword: false
    },
    registerForm: {
      username: '',
      password: '',
      confirmPassword: '',
      nickName: '',
      avatarUrl: ''
    },
    loading: false,
    showPassword: false
  },

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ loginAction: options.action || '' })
    this.loadUserInfo()
    if (options.action !== 'new') {
      this.loadSavedCredentials()
    }
  },

  /**
   * 加载用户信息
   */
  loadUserInfo() {
    try {
      const userInfo = wx.getStorageSync('userInfo')
      this.setData({
        userInfo: userInfo
      })
    } catch (err) {
      console.error('[LoginPage] 读取用户信息失败', err)
    }
  },

  /**
   * 加载保存的凭据
   */
  loadSavedCredentials() {
    try {
      const savedAccounts = wx.getStorageSync('savedAccounts') || []
      if (savedAccounts.length > 0) {
        const latest = savedAccounts[0]
        this.setData({
          'loginForm.username': latest.username,
          'loginForm.password': latest.password,
          'loginForm.rememberPassword': true
        })
      }
    } catch (err) {
      console.error('[LoginPage] 加载保存的凭据失败', err)
    }
  },

  /**
   * 切换登录/注册模式
   */
  toggleMode() {
    const newMode = this.data.mode === 'login' ? 'register' : 'login'
    this.setData({
      mode: newMode
    })
  },

  /**
   * 切换密码显示
   */
  togglePassword() {
    this.setData({
      showPassword: !this.data.showPassword
    })
  },

  /**
   * 登录表单输入
   */
  onLoginInput(e: WechatMiniprogram.Input) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`loginForm.${field}`]: e.detail.value
    })
  },

  /**
   * 注册表单输入
   */
  onRegisterInput(e: WechatMiniprogram.Input) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`registerForm.${field}`]: e.detail.value
    })
  },

  /**
   * 记住密码切换
   */
  onRememberPasswordChange(e: WechatMiniprogram.TouchEvent) {
    this.setData({
      'loginForm.rememberPassword': e.detail.value
    })
  },

  /**
   * 验证登录表单
   */
  validateLoginForm(): boolean {
    const { username, password } = this.data.loginForm

    if (!username.trim()) {
      wx.showToast({
        title: '请输入用户名',
        icon: 'none'
      })
      return false
    }

    if (!password.trim()) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none'
      })
      return false
    }

    if (username.length < 3 || username.length > 20) {
      wx.showToast({
        title: '用户名长度为3-20个字符',
        icon: 'none'
      })
      return false
    }

    if (password.length < 6) {
      wx.showToast({
        title: '密码长度至少6个字符',
        icon: 'none'
      })
      return false
    }

    return true
  },

  /**
   * 验证注册表单
   */
  validateRegisterForm(): boolean {
    const { username, password, confirmPassword, nickName } = this.data.registerForm

    if (!username.trim()) {
      wx.showToast({
        title: '请输入用户名',
        icon: 'none'
      })
      return false
    }

    if (username.length < 3 || username.length > 20) {
      wx.showToast({
        title: '用户名长度为3-20个字符',
        icon: 'none'
      })
      return false
    }

    const usernameRegex = /^[a-zA-Z0-9_]+$/
    if (!usernameRegex.test(username)) {
      wx.showToast({
        title: '用户名只能包含字母、数字和下划线',
        icon: 'none'
      })
      return false
    }

    if (!password.trim()) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none'
      })
      return false
    }

    if (password.length < 6) {
      wx.showToast({
        title: '密码长度至少6个字符',
        icon: 'none'
      })
      return false
    }

    if (password !== confirmPassword) {
      wx.showToast({
        title: '两次输入的密码不一致',
        icon: 'none'
      })
      return false
    }

    if (nickName && nickName.length > 20) {
      wx.showToast({
        title: '昵称最多20个字符',
        icon: 'none'
      })
      return false
    }

    return true
  },

  /**
   * 登录
   */
  async handleLogin() {
    if (!this.validateLoginForm()) {
      return
    }

    this.setData({ loading: true })

    try {
      const { loginForm } = this.data
      const { result } = await wx.cloud.callFunction({
        name: 'account_manager',
        data: {
          action: 'login',
          username: loginForm.username.trim(),
          password: loginForm.password
        }
      })
      const loginResult = result as { success: boolean; user?: any; error?: string }

      if (loginResult.success) {
        if (loginForm.rememberPassword) {
          const username = loginForm.username.trim()
          const savedAccounts = wx.getStorageSync('savedAccounts') || []
          const existingIndex = savedAccounts.findIndex(
            (a: any) => a.username === username
          )
          const accountEntry = {
            username,
            password: loginForm.password,
            nickName: loginResult.user?.nickName || username,
            avatarUrl: loginResult.user?.avatarUrl || '',
            lastLoginTime: Date.now()
          }
          if (existingIndex >= 0) {
            savedAccounts[existingIndex] = accountEntry
          } else {
            savedAccounts.unshift(accountEntry)
          }
          savedAccounts.sort((a: any, b: any) => b.lastLoginTime - a.lastLoginTime)
          wx.setStorageSync('savedAccounts', savedAccounts)
        }

        // 保存用户信息
        const userInfo = loginResult.user
        app.globalData.userInfo = userInfo
        wx.setStorageSync('userInfo', userInfo)

        // 更新页面数据
        this.setData({
          userInfo: userInfo
        })

        // 同步数据
        wx.showLoading({ title: '同步数据...' })
        const syncResult = await syncManager.syncFromCloudOnLogin()
        wx.hideLoading()

        wx.showToast({
          title: syncResult.success ? '登录成功' : '登录成功，但数据同步失败',
          icon: 'success',
          duration: 1500
        })

        setTimeout(() => {
          if (this.data.loginAction === 'new') {
            wx.switchTab({ url: '/pages/mine/mine' })
          } else {
            wx.navigateBack()
          }
        }, 1500)
      } else {
        wx.showToast({
          title: loginResult.error || '登录失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('[LoginPage] 登录失败', err)
      wx.showToast({
        title: '网络错误，请稍后重试',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 注册
   */
  async handleRegister() {
    if (!this.validateRegisterForm()) {
      return
    }

    this.setData({ loading: true })

    try {
      const { registerForm } = this.data
      const { result } = await wx.cloud.callFunction({
        name: 'account_manager',
        data: {
          action: 'register',
          username: registerForm.username.trim(),
          password: registerForm.password,
          nickName: registerForm.nickName.trim() || undefined,
          avatarUrl: registerForm.avatarUrl.trim() || undefined
        }
      })
      const registerResult = result as { success: boolean; user?: any; error?: string }

      if (registerResult.success) {
        wx.showToast({
          title: '注册成功，请登录',
          icon: 'success',
          duration: 1500
        })

        setTimeout(() => {
          this.setData({
            mode: 'login',
            'loginForm.username': registerForm.username.trim(),
            'loginForm.password': '',
            'registerForm.password': '',
            'registerForm.confirmPassword': ''
          })
        }, 1500)
      } else {
        wx.showToast({
          title: registerResult.error || '注册失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('[LoginPage] 注册失败', err)
      wx.showToast({
        title: '网络错误，请稍后重试',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 选择头像
   */
  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        if (res.tempFilePaths.length > 0) {
          this.setData({
            'registerForm.avatarUrl': res.tempFilePaths[0]
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
  }
})
