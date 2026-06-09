import { setEncryptedStorage, getEncryptedStorage } from './crypto'
import type { CardGroup, Card, StudyRecord, Favorite, BackupData } from './types'

// ==================== 本地存储操作 ====================

export function getLocalStorageData(key: string): any[] {
  try {
    const data = getEncryptedStorage(key)
    return data || []
  } catch (err: any) {
    console.error('[DB] 读取本地存储失败', err)
    return []
  }
}

export function setLocalStorageData(key: string, data: any[]): boolean {
  try {
    return setEncryptedStorage(key, data)
  } catch (err: any) {
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

  // FNV-1a 64-bit（比 DJB2 32-bit 更抗碰撞）
  const FNV_OFFSET = 0xcbf29ce484222325n
  const FNV_PRIME = 0x100000001b3n
  let hash = FNV_OFFSET
  for (let i = 0; i < combined.length; i++) {
    hash ^= BigInt(combined.charCodeAt(i))
    hash = (hash * FNV_PRIME) & 0xffffffffffffffffn
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
  } catch (err: any) {
    console.error('[DB] 读取每日学习时长失败', err)
    return {}
  }
}

export function setDailyStudyMap(data: DailyStudyMap): boolean {
  try {
    return setEncryptedStorage(DAILY_STUDY_KEY, data)
  } catch (err: any) {
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
  if (!setDailyStudyMap(data)) {
    throw new Error('存储写入失败，请检查存储空间')
  }
  return data
}

// ==================== 本地集合类 ====================

/** 写入互斥锁（串行化读-改-写操作，防止并发竞态） */
let writeQueue: Promise<any> = Promise.resolve()

function enqueueWrite<T>(fn: () => T): Promise<T> {
  const result = writeQueue.then(fn)
  // 链式更新 writeQueue，确保后续操作等待当前操作完成
  writeQueue = result.catch(() => {})
  return result
}

class LocalCollection {
  key: string
  collectionName: string
  private orderField: string = ''
  private orderDir: number = 1  // 1 = asc, -1 = desc

  constructor(key: string, collectionName: string) {
    this.key = key
    this.collectionName = collectionName
  }

  add({ data }: { data: any }): Promise<{ _id: string }> {
    return enqueueWrite(() => {
      const items = getLocalStorageData(this.key)
      const newItem = {
        ...data,
        _id: data._id || generateId(),
        createTime: data.createTime || new Date(),
        updateTime: new Date()
      }
      items.push(newItem)
      if (!setLocalStorageData(this.key, items)) {
        throw new Error('存储写入失败，请检查存储空间')
      }
      return { _id: newItem._id }
    })
  }

  get(): Promise<{ data: any[] }> {
    const items = getLocalStorageData(this.key)
    if (this.orderField) {
      items.sort((a, b) => {
        const av = a[this.orderField], bv = b[this.orderField]
        if (av < bv) return -1 * this.orderDir
        if (av > bv) return 1 * this.orderDir
        return 0
      })
    }
    return Promise.resolve({ data: items })
  }

  orderBy(field: string, order: string): LocalCollection {
    this.orderField = field
    this.orderDir = order === 'desc' ? -1 : 1
    return this
  }

  where(query: any): LocalQuery {
    return new LocalQuery(this.key, query)
  }

  doc(id: string): LocalDoc {
    return new LocalDoc(this.key, id, this.collectionName)
  }
}

class LocalQuery {
  key: string
  query: any
  private orderField: string = ''
  private orderDir: number = 1

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
    if (this.orderField) {
      filtered.sort((a, b) => {
        const av = a[this.orderField], bv = b[this.orderField]
        if (av < bv) return -1 * this.orderDir
        if (av > bv) return 1 * this.orderDir
        return 0
      })
    }
    return Promise.resolve({ data: filtered })
  }

  orderBy(field: string, order: string): LocalQuery {
    this.orderField = field
    this.orderDir = order === 'desc' ? -1 : 1
    return this
  }
}

class LocalDoc {
  key: string
  id: string
  collectionName: string

  constructor(key: string, id: string, collectionName: string) {
    this.key = key
    this.id = id
    this.collectionName = collectionName
  }

  private getMatchField(): string {
    switch (this.collectionName) {
      case 'cards': return 'cardId'
      case 'cardGroups': return 'groupId'
      case 'favorites': return 'favoriteId'
      case 'studyRecords': return 'recordId'
      default: return '_id'
    }
  }

  update({ data }: { data: any }): Promise<any> {
    return enqueueWrite(() => {
      const items = getLocalStorageData(this.key)
      const matchField = this.getMatchField()
      const index = items.findIndex(item => item[matchField] === this.id)
      if (index !== -1) {
        items[index] = { ...items[index], ...data, updateTime: new Date() }
        if (!setLocalStorageData(this.key, items)) {
          throw new Error('存储写入失败，请检查存储空间')
        }
      }
      return {}
    })
  }

  remove(): Promise<any> {
    return enqueueWrite(() => {
      const items = getLocalStorageData(this.key)
      const matchField = this.getMatchField()
      const filtered = items.filter(item => item[matchField] !== this.id)
      if (!setLocalStorageData(this.key, filtered)) {
        throw new Error('存储写入失败，请检查存储空间')
      }
      return {}
    })
  }

  get(): Promise<{ data: any }> {
    const items = getLocalStorageData(this.key)
    const matchField = this.getMatchField()
    const item = items.find(item => item[matchField] === this.id)
    return Promise.resolve({ data: item || null })
  }

  set(options: { data: any }): Promise<any> {
    return enqueueWrite(() => {
      const items = getLocalStorageData(this.key)
      const matchField = this.getMatchField()
      const index = items.findIndex(item => item[matchField] === this.id)
      if (index !== -1) {
        items[index] = { ...items[index], ...options.data, updateTime: new Date() }
      } else {
        const newItem = { ...options.data, _id: this.id, createTime: new Date(), updateTime: new Date() }
        items.push(newItem)
      }
      if (!setLocalStorageData(this.key, items)) {
        throw new Error('存储写入失败，请检查存储空间')
      }
      return {}
    })
  }
}

// ==================== 导出集合实例（纯本地） ====================

export const cardGroupCollection = new LocalCollection('card_groups', 'cardGroups')
export const cardCollection = new LocalCollection('cards', 'cards')
export const studyRecordCollection = new LocalCollection('study_records', 'studyRecords')
export const favoriteCollection = new LocalCollection('favorites', 'favorites')

// 兼容旧引用
export const userCollection = new LocalCollection('users', 'users')
export const backupCollection = new LocalCollection('backups', 'backups')

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
      if (!setLocalStorageData(localKey, filtered)) {
        throw new Error(`本地删除 ${localKey} 写入失败`)
      }
    } catch (err: any) {
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
    if (!setDailyStudyMap(daily)) {
      const msg = '清理每日学习时长写入失败'
      console.error(`[DB] ${msg}`)
      errors.push(msg)
    }
  } catch (err: any) {
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
  } catch (err: any) {
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
    // 1. 保存恢复前的快照（用于回滚）
    const currentData = exportAllLocalData()
    setEncryptedStorage('backup_before_import', currentData)

    // 2. 全覆盖恢复：卡牌组、卡牌、收藏（这些是"内容"，应当完全还原）
    setLocalStorageData(STORAGE_KEYS.CARD_GROUPS, data.cardGroups)
    setLocalStorageData(STORAGE_KEYS.CARDS, data.cards)
    setLocalStorageData(STORAGE_KEYS.FAVORITES, data.favorites)

    // 3. 合并恢复学习记录（保留现有记录 + 追加备份中的记录）
    const existingRecords = getLocalStorageData(STORAGE_KEYS.STUDY_RECORDS) as any[]
    const existingIds = new Set(existingRecords.map((r: any) => r.recordId))
    const newRecords = (data.studyRecords || []).filter(r => !existingIds.has(r.recordId))
    setLocalStorageData(STORAGE_KEYS.STUDY_RECORDS, [...existingRecords, ...newRecords].slice(-5000))

    // 4. 合并恢复每日学习时长（累加，不覆盖）
    if (data.studyDaily) {
      const localDaily = getDailyStudyMap()
      for (const [dateStr, entry] of Object.entries(data.studyDaily)) {
        if (!localDaily[dateStr]) {
          localDaily[dateStr] = { totalDuration: 0, groups: {} }
        }
        localDaily[dateStr].totalDuration += entry.totalDuration
        for (const [groupId, duration] of Object.entries(entry.groups)) {
          localDaily[dateStr].groups[groupId] =
            (localDaily[dateStr].groups[groupId] || 0) + duration
        }
      }
      setDailyStudyMap(localDaily)
    }

    // 5. 恢复用户设置
    if (data.settings) {
      for (const [key, val] of Object.entries(data.settings)) {
        try { wx.setStorageSync(key, val) } catch (_) { /* 忽略 */ }
      }
    }

    console.log('[DB] 数据导入成功（合并模式）')
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
