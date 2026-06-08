import type { IAppOption } from './types'

const app = getApp<IAppOption>()

/**
 * 尝试自动登录
 * 启动时检查本地是否有已保存的凭据，如有则自动登录
 */
export async function tryAutoLogin(): Promise<boolean> {
  const savedAccounts = wx.getStorageSync('savedAccounts') || []

  if (savedAccounts.length === 0) {
    console.log('[Auth] 无已保存账号，跳过自动登录')
    return false
  }

  // 取最近登录的账号
  const latestAccount = savedAccounts[0]
  console.log('[Auth] 尝试自动登录:', latestAccount.username)

  try {
    const { result } = await wx.cloud.callFunction({
      name: 'account_manager',
      data: {
        action: 'login',
        username: latestAccount.username,
        password: latestAccount.password
      }
    })

    const loginResult = result as { success: boolean; user?: any; error?: string }

    if (loginResult.success && loginResult.user) {
      // 登录成功
      const userInfo = loginResult.user
      app.globalData.userInfo = userInfo
      wx.setStorageSync('userInfo', userInfo)

      // 更新最近登录时间
      latestAccount.lastLoginTime = Date.now()
      latestAccount.nickName = userInfo.nickName || latestAccount.nickName
      latestAccount.avatarUrl = userInfo.avatarUrl || latestAccount.avatarUrl
      wx.setStorageSync('savedAccounts', savedAccounts)

      console.log('[Auth] 自动登录成功')
      return true
    } else {
      // 凭据失效，清除
      console.warn('[Auth] 自动登录失败:', loginResult.error)
      wx.removeStorageSync('userInfo')
      app.globalData.userInfo = null
      return false
    }
  } catch (err) {
    console.error('[Auth] 自动登录网络错误', err)
    // 网络错误，如果有本地 userInfo 则恢复
    const cachedUser = wx.getStorageSync('userInfo')
    if (cachedUser) {
      app.globalData.userInfo = cachedUser
      return true
    }
    return false
  }
}
