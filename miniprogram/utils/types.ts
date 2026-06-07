export interface User {
  _openid: string
  nickName?: string
  avatarUrl?: string
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
  createTime: Date
  updateTime: number
  syncStatus?: 'local' | 'synced' | 'pending'
}

export interface Card {
  cardId: string
  groupId: string
  userId: string
  front: string
  back: string
  createTime: Date
  updateTime: number
  syncStatus?: 'local' | 'synced' | 'pending'
}

export interface StudyRecord {
  recordId: string
  userId: string
  groupId: string
  studyDuration: number
  studyDate: Date
  updateTime: number
  syncStatus?: 'local' | 'synced' | 'pending'
}

export interface Favorite {
  favoriteId: string
  userId: string
  cardId: string
  groupId: string
  createTime: Date
  updateTime: number
  syncStatus?: 'local' | 'synced' | 'pending'
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
}

// 同步状态
export interface SyncStatus {
  lastSyncTime?: Date
  isSyncing: boolean
  pendingItems: number
  lastError?: string
}

export interface IAppOption {
  globalData: {
    userInfo: User | null
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserProfileSuccessCallbackResult
}

export type SyncChangeType = 'add' | 'update' | 'remove'

export interface SyncChange {
  id: string
  type: SyncChangeType
  collection: 'cardGroups' | 'cards' | 'studyRecords' | 'favorites'
  item: any
  updateTime: number
  retryCount: number
}

export interface SyncResult {
  success: boolean
  processed: number
  skipped: number
  conflicts: Array<{ id: string; cloudUpdateTime: number; localUpdateTime: number }>
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
