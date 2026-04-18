const db = wx.cloud.database()

export const userCollection = db.collection('users')
export const cardGroupCollection = db.collection('cardGroups')
export const cardCollection = db.collection('cards')
export const studyRecordCollection = db.collection('studyRecords')
export const favoriteCollection = db.collection('favorites')

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}
