import { setEncryptedStorage, getEncryptedStorage } from './crypto'
import type { CardGroup, Card, StudyRecord, Favorite, BackupData } from './types'

// ==================== 本地存储操作 ====================

export function getLocalStorageData(key: string): any[] {
  try {
    const data = getEncryptedStorage(key)
    return data || []
  } catch (err) {
    console.error('[DB] 读取本地存储失败', err)
    return []
  }
}

export function setLocalStorageData(key: string, data: any[]): boolean {
  try {
    return setEncryptedStorage(key, data)
  } catch (err) {
    console.error('[DB] 保存本地存储失败', err)
    return false
  }
}

// ==================== 生成唯一ID ====================

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

// ==================== 数据哈希（用于备份状态对比） ====================

export function computeLocalHash(): string {
  const cardGroups = getLocalStorageData('card_groups') || []
  const cards = getLocalStorageData('cards') || []
  const studyRecords = getLocalStorageData('study_records') || []
  const favorites = getLocalStorageData('favorites') || []
  const studyDaily = getDailyStudyMap()

  const combined = JSON.stringify(cardGroups) + JSON.stringify(cards)
    + JSON.stringify(studyRecords) + JSON.stringify(favorites)
    + JSON.stringify(studyDaily)

  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(36)
}

// ==================== 每日学习时长（按日聚合，本地优先） ====================

export interface DailyStudyEntry {
  totalDuration: number
  groups: Record<string, number>
}

export type DailyStudyMap = Record<string, DailyStudyEntry>

const DAILY_STUDY_KEY = 'study_daily'

export function getDailyStudyMap(): DailyStudyMap {
  try {
    return getEncryptedStorage(DAILY_STUDY_KEY) || {}
  } catch (err) {
    console.error('[DB] 读取每日学习时长失败', err)
    return {}
  }
}

export function setDailyStudyMap(data: DailyStudyMap): boolean {
  try {
    return setEncryptedStorage(DAILY_STUDY_KEY, data)
  } catch (err) {
    console.error('[DB] 保存每日学习时长失败', err)
    return false
  }
}

/** 增加某日某卡牌组的学习时长（秒），返回更新后的 daily map */
export function addDailyStudyDuration(date: string, groupId: string, duration: number): DailyStudyMap {
  const data = getDailyStudyMap()
  if (!data[date]) {
    data[date] = { totalDuration: 0, groups: {} }
  }
  data[date].totalDuration += duration
  data[date].groups[groupId] = (data[date].groups[groupId] || 0) + duration
  setDailyStudyMap(data)
  return data
}

// ==================== 本地集合类 ====================

class LocalCollection {
  key: string

  constructor(key: string) {
    this.key = key
  }

  add({ data }: { data: any }): Promise<{ _id: string }> {
    const items = getLocalStorageData(this.key)
    const newItem = {
      ...data,
      _id: data._id || generateId(),
      createTime: data.createTime || new Date(),
      updateTime: new Date()
    }
    items.push(newItem)
    setLocalStorageData(this.key, items)
    return Promise.resolve({ _id: newItem._id })
  }

  get(): Promise<{ data: any[] }> {
    const items = getLocalStorageData(this.key)
    return Promise.resolve({ data: items })
  }

  orderBy(_field: string, _order: string): LocalCollection {
    return this
  }

  where(query: any): LocalQuery {
    return new LocalQuery(this.key, query)
  }

  doc(id: string): LocalDoc {
    return new LocalDoc(this.key, id)
  }
}

class LocalQuery {
  key: string
  query: any

  constructor(key: string, query: any) {
    this.key = key
    this.query = query
  }

  get(): Promise<{ data: any[] }> {
    const items = getLocalStorageData(this.key)
    const filtered = items.filter(item => {
      for (const k in this.query) {
        if (item[k] !== this.query[k]) return false
      }
      return true
    })
    return Promise.resolve({ data: filtered })
  }

  orderBy(_field: string, _order: string): LocalQuery {
    return this
  }
}

class LocalDoc {
  key: string
  id: string

  constructor(key: string, id: string) {
    this.key = key
    this.id = id
  }

  update({ data }: { data: any }): Promise<any> {
    const items = getLocalStorageData(this.key)
    const index = items.findIndex(
      item => item._id === this.id || item.groupId === this.id || item.cardId === this.id || item.recordId === this.id || item.favoriteId === this.id
    )
    if (index !== -1) {
      items[index] = { ...items[index], ...data, updateTime: new Date() }
      setLocalStorageData(this.key, items)
    }
    return Promise.resolve({})
  }

  remove(): Promise<any> {
    const items = getLocalStorageData(this.key)
    const filtered = items.filter(
      item => item._id !== this.id && item.groupId !== this.id && item.cardId !== this.id && item.recordId !== this.id && item.favoriteId !== this.id
    )
    setLocalStorageData(this.key, filtered)
    return Promise.resolve({})
  }

  get(): Promise<{ data: any }> {
    const items = getLocalStorageData(this.key)
    const item = items.find(
      item => item._id === this.id || item.groupId === this.id || item.cardId === this.id || item.recordId === this.id || item.favoriteId === this.id
    )
    return Promise.resolve({ data: item || null })
  }

  set(options: { data: any }): Promise<any> {
    const items = getLocalStorageData(this.key)
    const index = items.findIndex(
      item => item._id === this.id || item.groupId === this.id || item.cardId === this.id || item.recordId === this.id || item.favoriteId === this.id
    )
    if (index !== -1) {
      items[index] = { ...items[index], ...options.data, updateTime: new Date() }
    } else {
      const newItem = { ...options.data, _id: this.id, updateTime: new Date() }
      items.push(newItem)
    }
    setLocalStorageData(this.key, items)
    return Promise.resolve({})
  }
}

// ==================== 导出集合实例（纯本地） ====================

export const cardGroupCollection = new LocalCollection('card_groups')
export const cardCollection = new LocalCollection('cards')
export const studyRecordCollection = new LocalCollection('study_records')
export const favoriteCollection = new LocalCollection('favorites')

// 兼容旧引用
export const userCollection = new LocalCollection('users')
export const backupCollection = new LocalCollection('backups')

// ==================== 统一删除卡牌组 ====================

const DELETE_LOCAL_KEYS = ['card_groups', 'cards', 'favorites', 'study_records']

/**
 * 从本地删除指定 groupId 的所有数据（卡牌组、卡牌、收藏、学习记录）
 */
export async function deleteCardGroup(groupId: string): Promise<void> {
  if (!groupId) throw new Error('groupId 不能为空')

  const errors: string[] = []

  for (const localKey of DELETE_LOCAL_KEYS) {
    try {
      const items = getLocalStorageData(localKey)
      const filtered = items.filter((item: any) => item.groupId !== groupId)
      setLocalStorageData(localKey, filtered)
    } catch (err) {
      const msg = `本地删除 ${localKey} 失败`
      console.error(`[DB] ${msg}`, err)
      errors.push(msg)
    }
  }

  // 同时清理每日学习时长中该卡牌组的数据
  try {
    const daily = getDailyStudyMap()
    for (const dateKey of Object.keys(daily)) {
      if (daily[dateKey].groups[groupId] !== undefined) {
        daily[dateKey].totalDuration -= daily[dateKey].groups[groupId]
        delete daily[dateKey].groups[groupId]
        if (daily[dateKey].totalDuration <= 0) {
          delete daily[dateKey]
        }
      }
    }
    setDailyStudyMap(daily)
  } catch (err) {
    const msg = '清理每日学习时长失败'
    console.error(`[DB] ${msg}`, err)
    errors.push(msg)
  }

  if (errors.length > 0) {
    throw new Error(`删除卡牌组部分失败: ${errors.join('; ')}`)
  }
}

export async function getUserId(): Promise<string> {
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'backup_manager',
      data: { action: 'getUserId' }
    })
    const res = result as { success: boolean; userId?: string }
    if (res.success && res.userId) {
      return res.userId
    }
    return 'local_user'
  } catch (err) {
    console.error('[DB] 获取用户ID失败', err)
    return 'local_user'
  }
}

// ==================== 数据导入/导出 ====================

const STORAGE_KEYS = {
  CARD_GROUPS: 'card_groups',
  CARDS: 'cards',
  FAVORITES: 'favorites',
  STUDY_RECORDS: 'study_records'
}

/** 用户设置项（通过 wx.setStorageSync 存储的独立设置） */
const USER_SETTING_KEYS = ['dailyGoalMinutes']

export function exportAllLocalData(): BackupData {
  const cardGroups = getLocalStorageData(STORAGE_KEYS.CARD_GROUPS) as CardGroup[]
  const cards = getLocalStorageData(STORAGE_KEYS.CARDS) as Card[]
  const studyRecords = getLocalStorageData(STORAGE_KEYS.STUDY_RECORDS) as StudyRecord[]
  const favorites = getLocalStorageData(STORAGE_KEYS.FAVORITES) as Favorite[]
  const studyDailyData = getDailyStudyMap()

  // 收集用户独立设置
  const settings: Record<string, any> = {}
  for (const key of USER_SETTING_KEYS) {
    try {
      const val = wx.getStorageSync(key)
      if (val !== '' && val != null) {
        settings[key] = val
      }
    } catch (_) { /* 忽略读取失败的 key */ }
  }

  return {
    version: '1.0',
    schemaVersion: '2.0',
    appVersion: '1.0.0',
    backupTime: new Date(),
    summary: {
      cardGroupCount: cardGroups.length,
      cardCount: cards.length,
      studyRecordCount: studyRecords.length,
      favoriteCount: favorites.length
    },
    cardGroups,
    cards,
    studyRecords,
    favorites,
    studyDaily: studyDailyData,
    settings: Object.keys(settings).length > 0 ? settings : undefined
  }
}

export function importLocalData(data: BackupData): boolean {
  try {
    const currentData = exportAllLocalData()
    setEncryptedStorage('backup_before_import', currentData)
    setLocalStorageData(STORAGE_KEYS.CARD_GROUPS, data.cardGroups)
    setLocalStorageData(STORAGE_KEYS.CARDS, data.cards)
    setLocalStorageData(STORAGE_KEYS.STUDY_RECORDS, data.studyRecords)
    setLocalStorageData(STORAGE_KEYS.FAVORITES, data.favorites)

    // 恢复每日学习时长（studyDaily）
    if (data.studyDaily) {
      setDailyStudyMap(data.studyDaily)
    }

    // 恢复用户设置
    if (data.settings) {
      for (const [key, val] of Object.entries(data.settings)) {
        try { wx.setStorageSync(key, val) } catch (_) { /* 忽略 */ }
      }
    }

    console.log('[DB] 数据导入成功')
    return true
  } catch (error) {
    console.error('[DB] 数据导入失败', error)
    return false
  }
}

export function getStorageInfo(): { used: number; limit: number } {
  try {
    const info = wx.getStorageInfoSync()
    return { used: info.currentSize, limit: info.limitSize }
  } catch {
    return { used: 0, limit: 10240 }
  }
}

export function clearAllLocalData(): void {
  try {
    wx.clearStorageSync()
    console.log('[DB] 所有本地数据已清除')
  } catch (error) {
    console.error('[DB] 清除本地数据失败', error)
  }
}
