const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 密码加密
function hashPassword(password, salt = '') {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, actualSalt, 1000, 64, 'sha512').toString('hex')
  return { hash, salt: actualSalt }
}

// 验证密码
function verifyPassword(password, hash, salt) {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')
  return verifyHash === hash
}

exports.main = async (event, context) => {
  const { action, username, password, nickName, avatarUrl, avatarHash, rememberPassword, oldPassword, newPassword } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    if (action === 'register') {
      // 注册新账号
      const { data: existingUsers } = await db.collection('users').where({
        username: username
      }).get()

      if (existingUsers.length > 0) {
        return {
          success: false,
          error: '用户名已存在，请使用其他用户名'
        }
      }

      const { hash, salt } = hashPassword(password)

      await db.collection('users').add({
        data: {
          _openid: openid,
          username: username,
          passwordHash: hash,
          passwordSalt: salt,
          nickName: nickName || username,
          avatarUrl: avatarUrl || '',
          avatarHash: avatarHash || '',
          passwordVersion: 1,
          createTime: new Date(),
          lastLoginTime: new Date()
        }
      })

      return {
        success: true,
        message: '注册成功'
      }
    } else if (action === 'login') {
      // 登录账号
      const { data: users } = await db.collection('users').where({
        username: username
      }).get()

      if (users.length === 0) {
        return {
          success: false,
          error: '用户名或密码错误'
        }
      }

      const user = users[0]
      const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt)

      if (!isValid) {
        return {
          success: false,
          error: '用户名或密码错误'
        }
      }

      // 更新登录时间
      await db.collection('users').doc(user._id).update({
        data: {
          lastLoginTime: new Date()
        }
      })

      return {
        success: true,
        user: {
          _openid: openid,
          username: user.username,
          nickName: user.nickName,
          avatarUrl: user.avatarUrl,
          avatarHash: user.avatarHash || '',
          passwordVersion: user.passwordVersion || 1,
          createTime: user.createTime,
          lastLoginTime: new Date()
        },
        message: '登录成功'
      }
    } else if (action === 'checkUsername') {
      // 检查用户名是否存在
      const { data: users } = await db.collection('users').where({
        username: username
      }).get()

      return {
        success: true,
        exists: users.length > 0
      }
    } else if (action === 'getUser') {
      // 获取用户信息
      const { data: users } = await db.collection('users').where({
        _openid: openid
      }).get()

      if (users.length === 0) {
        return {
          success: false,
          error: '用户不存在'
        }
      }

      const user = users[0]
      return {
        success: true,
        user: {
          _openid: openid,
          username: user.username,
          nickName: user.nickName,
          avatarUrl: user.avatarUrl,
          avatarHash: user.avatarHash || '',
          passwordVersion: user.passwordVersion || 1,
          createTime: user.createTime,
          lastLoginTime: user.lastLoginTime
        }
      }
    } else if (action === 'updateProfile') {
      const { data: users } = await db.collection('users').where({
        _openid: openid
      }).get()

      if (users.length === 0) {
        return { success: false, error: '用户不存在' }
      }

      const user = users[0]
      const updateData = {}
      if (nickName !== undefined) updateData.nickName = nickName
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl
      if (avatarHash !== undefined) updateData.avatarHash = avatarHash

      if (Object.keys(updateData).length === 0) {
        return { success: false, error: '没有需要更新的内容' }
      }

      await db.collection('users').doc(user._id).update({ data: updateData })

      return {
        success: true,
        user: {
          _openid: openid,
          username: user.username,
          nickName: nickName !== undefined ? nickName : user.nickName,
          avatarUrl: avatarUrl !== undefined ? avatarUrl : user.avatarUrl,
          avatarHash: avatarHash !== undefined ? avatarHash : (user.avatarHash || ''),
          passwordVersion: user.passwordVersion || 1,
          createTime: user.createTime,
          lastLoginTime: user.lastLoginTime
        }
      }
    } else if (action === 'updatePassword') {
      const { data: users } = await db.collection('users').where({
        _openid: openid
      }).get()

      if (users.length === 0) {
        return { success: false, error: '用户不存在' }
      }

      const user = users[0]
      const isValid = verifyPassword(oldPassword, user.passwordHash, user.passwordSalt)
      if (!isValid) {
        return { success: false, error: '当前密码错误' }
      }

      if (!newPassword || newPassword.length < 6) {
        return { success: false, error: '新密码至少6个字符' }
      }

      const { hash, salt } = hashPassword(newPassword)
      const newVersion = (user.passwordVersion || 1) + 1
      await db.collection('users').doc(user._id).update({
        data: {
          passwordHash: hash,
          passwordSalt: salt,
          passwordVersion: newVersion
        }
      })

      return {
        success: true,
        message: '密码修改成功，请重新登录',
        passwordVersion: newVersion
      }
    }

    return { success: false, error: '未知操作' }
  } catch (err) {
    console.error('[AccountManager] 操作失败', err)
    return { success: false, error: err.message || '操作失败，请稍后重试' }
  }
}
