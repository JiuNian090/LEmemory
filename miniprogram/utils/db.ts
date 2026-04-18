const db = wx.cloud.database()

export const userCollection = db.collection('users')
export const cardGroupCollection = db.collection('cardGroups')
export const cardCollection = db.collection('cards')
export const studyRecordCollection = db.collection('studyRecords')
export const favoriteCollection = db.collection('favorites')

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

/**
 * 获取当前用户的 openid
 */
export async function getUserId(): Promise<string> {
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'user_login'
    })
    return (result as any).openid
  } catch (err) {
    console.error('[DB] 获取用户ID失败', err)
    return ''
  }
}
