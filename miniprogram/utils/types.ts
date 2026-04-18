interface User {
  _openid: string
  nickName?: string
  avatarUrl?: string
  createTime: Date
}

interface CardGroup {
  groupId: string
  userId: string
  title: string
  description?: string
  createTime: Date
  updateTime: Date
}

interface Card {
  cardId: string
  groupId: string
  userId: string
  front: string
  back: string
  createTime: Date
}

interface StudyRecord {
  recordId: string
  userId: string
  groupId: string
  studyDuration: number
  studyDate: Date
}

interface Favorite {
  favoriteId: string
  userId: string
  cardId: string
  groupId: string
  createTime: Date
}

interface IAppOption {
  globalData: {
    userInfo: WechatMiniprogram.UserInfo | null
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserProfileSuccessCallbackResult
}
