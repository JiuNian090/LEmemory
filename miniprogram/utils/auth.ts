import type { IAppOption } from './types'

const app = getApp<IAppOption>()

/**
 * 尝试自动登录
 * 启动时检查本地是否有已保存的凭据（sessionToken），如有则自动验证
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
    // 使用 sessionToken 验证（无需明文密码）
    const { result } = await wx.cloud.callFunction({
      name: 'account_manager',
      data: {
        action: 'verifySession',
        username: latestAccount.username,
        sessionToken: latestAccount.sessionToken
      }
    })

    // [P1] 类型断言保护 — result 可能为 null/undefined
    const loginResult = result as { success: boolean; user?: any; error?: string } | null
    if (!loginResult || typeof loginResult.success !== 'boolean') {
      console.error('[Auth] 登录返回格式异常:', result)
      // 移除异常账户，避免卡死
      savedAccounts.shift()
      wx.setStorageSync('savedAccounts', savedAccounts)
      return false
    }

    if (loginResult.success && loginResult.user) {
      // 登录成功
      const userInfo = loginResult.user
      app.globalData.userInfo = userInfo
      wx.setStorageSync('userInfo', userInfo)

      // 更新最近登录时间
      latestAccount.lastLoginTime = Date.now()
      // [P2] || 改 ?? 空值合并
      latestAccount.nickName = userInfo.nickName ?? latestAccount.nickName
      latestAccount.avatarUrl = userInfo.avatarUrl ?? latestAccount.avatarUrl
      wx.setStorageSync('savedAccounts', savedAccounts)

      console.log('[Auth] 自动登录成功')
      return true
    } else {
      // [P0] 凭据失效，移除失败账户避免无限重试
      console.warn('[Auth] 自动登录失败:', loginResult.error)
      wx.removeStorageSync('userInfo')
      app.globalData.userInfo = null
      if (savedAccounts && savedAccounts.length > 0) {
        savedAccounts.shift()
        wx.setStorageSync('savedAccounts', savedAccounts)
      }
      return false
    }
  } catch (err: any) {
    // [P0] 网络错误始终返回 false，不谎称登录成功
    console.error('[Auth] 自动登录网络错误', err)
    const cachedUser = wx.getStorageSync('userInfo')
    if (cachedUser) {
      app.globalData.userInfo = cachedUser
    }
    return false
  }
}
