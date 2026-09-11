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
  /** 绑定的卡牌模板 id；缺省表示使用内置默认模板 */
  templateId?: string
  createTime: Date
  updateTime: number
}

/** 用户手动标记的掌握程度 */
export type MasteryStatus = 'new' | 'learning' | 'mastered' | 'difficult'

/** 间隔重复调度状态（惰性初始化：首次复习时写入） */
export interface SrsState {
  /** 当前复习间隔（天） */
  interval: number
  /** 难度因子，范围 [1.3, 2.8]，初始 2.5 */
  ease: number
  /** 累计遗忘次数 */
  lapses: number
  /** 上次复习日期 'YYYY-MM-DD' */
  lastReviewDate: string
  /** 下次应复习日期 'YYYY-MM-DD' */
  nextReviewDate: string
}

export interface Card {
  cardId: string
  groupId: string
  userId: string
  front: string
  back: string
  createTime: Date
  updateTime: number
  /** 用户手动标记的掌握程度，缺省视为新卡 */
  status?: MasteryStatus
  /** 累计复习次数 */
  reviewCount?: number
  /** 间隔重复调度状态；旧数据缺失时视为新卡 */
  srs?: SrsState
  /** 扩展字段内容（显示名由绑定的模板决定） */
  extra?: string
}

// ==================== 卡牌模板 ====================

/** 模板字段角色：决定字段用途 */
export type TemplateFieldRole = 'question' | 'answer' | 'extra'

/** 模板字段 */
export interface TemplateField {
  /** 字段标识 */
  fieldId: string
  /** 角色 */
  role: TemplateFieldRole
  /** 自定义显示名 */
  name: string
}

/** 卡牌模板：定义「问题 / 答案 / 扩展」三类字段的显示名 */
export interface CardTemplate {
  templateId: string
  userId: string
  /** 模板名，如「英语单词」 */
  name: string
  fields: TemplateField[]
  createTime: Date
  updateTime: number
  /** 内置模板（不可编辑/删除） */
  isBuiltin?: boolean
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
  studyDaily?: Record<string, { totalDuration: number; groups: Record<string, number> }>
  settings?: Record<string, any>
}

export interface IAppOption {
  globalData: {
    userInfo: User | null
    appVersion: string
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserProfileSuccessCallbackResult
}

// ==================== 统计接口 ====================

export type PeriodType = 'week' | 'month' | 'year' | 'all' | 'custom'

/** 图表时间粒度：按天/按周/按月 */
export type ChartTimeUnit = 'day' | 'week' | 'month'

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
  level: 0 | 1 | 2 | 3 | 4 | 5
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
  chartUnit: ChartTimeUnit
  trendData: TrendPoint[]
  monthlyData: MonthlyPoint[]
  heatmapData: HeatmapPoint[]
  groupPieData: PieSlice[]
  startDate: string
  endDate: string
  periodType: PeriodType
}
