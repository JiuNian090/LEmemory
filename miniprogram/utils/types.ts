export interface User {
  _openid: string
  nickName?: string
  avatarUrl?: string
  /** 本地缓存的头像文件路径（wx.env.USER_DATA_PATH 下） */
  avatarLocalPath?: string
  createTime: Date
  lastSyncTime?: Date
  username?: string
  lastLoginTime?: Date
}

// 登录凭据
export interface LoginCredentials {
  username: string
  password: string
  rememberPassword?: boolean
}

// 注册信息
export interface RegisterInfo {
  username: string
  password: string
  confirmPassword: string
  nickName?: string
  avatarUrl?: string
}

export interface CardGroup {
  groupId: string
  userId: string
  title: string
  description?: string
  /** 表情图标，如'📚'、'🎯'等，默认'🎴' */
  emoji?: string
  createTime: Date
  updateTime: number
}

export interface Card {
  cardId: string
  groupId: string
  userId: string
  front: string
  back: string
  createTime: Date
  updateTime: number
}

export interface StudyRecord {
  recordId: string
  userId: string
  groupId: string
  studyDuration: number
  studyDate: Date
  updateTime: number
}

export interface Favorite {
  favoriteId: string
  userId: string
  cardId: string
  groupId: string
  createTime: Date
  updateTime: number
}

// 备份记录
export interface BackupRecord {
  backupId: string
  userId: string
  backupTime: Date
  dataSize: number
  description?: string
  cardGroupsCount: number
  cardsCount: number
  studyRecordsCount: number
  favoritesCount: number
}

// 完整备份数据
export interface BackupData {
  version: string
  schemaVersion?: string
  appVersion?: string
  backupTime: Date
  userId?: string
  summary?: {
    cardGroupCount: number
    cardCount: number
    studyRecordCount: number
    favoriteCount: number
  }
  cardGroups: CardGroup[]
  cards: Card[]
  studyRecords: StudyRecord[]
  favorites: Favorite[]
  settings?: Record<string, any>
}

export interface IAppOption {
  globalData: {
    userInfo: User | null
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserProfileSuccessCallbackResult
}

// ==================== 统计接口 ====================

export type PeriodType = 'week' | 'month' | 'year' | 'all' | 'custom'

export interface TrendPoint {
  date: string
  duration: number
  label: string
}

export interface MonthlyPoint {
  month: string
  duration: number
}

export interface HeatmapPoint {
  date: string
  value: number
  level: 0 | 1 | 2 | 3 | 4
}

export interface PieSlice {
  groupId: string
  title: string
  value: number
  percentage: number
  color: string
}

export interface StatisticsResult {
  totalDuration: number
  studyDays: number
  cardCount: number
  groupCount: number
  previousDuration: number
  changePercent: number
  changeText: string
  changeDirection: 'up' | 'down' | 'flat'
  dailyGoalMinutes: number
  achievedDays: number
  achievementRate: number
  currentStreak: number
  longestStreak: number
  trendData: TrendPoint[]
  monthlyData: MonthlyPoint[]
  heatmapData: HeatmapPoint[]
  groupPieData: PieSlice[]
  startDate: string
  endDate: string
  periodType: PeriodType
}
