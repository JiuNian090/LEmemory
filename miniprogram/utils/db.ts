// 延迟初始化，确保 app.ts 中的 wx.cloud.init 先执行
import { setEncryptedStorage, getEncryptedStorage } from './crypto'
import type { CardGroup, Card, StudyRecord, Favorite, BackupData, SyncStatus } from './types'

let db: any = null
let useCloud = true
let initialized = false

// 本地存储键名
const STORAGE_KEYS = {
  CARD_GROUPS: 'card_groups',
  CARDS: 'cards',
  FAVORITES: 'favorites',
  STUDY_RECORDS: 'study_records',
  SYNC_STATUS: 'sync_status',
  PENDING_SYNC: 'pending_sync'
}

/**
 * 初始化数据库连接
 */
function initDB() {
  if (initialized) return
  
  try {
    if (wx.cloud) {
      db = wx.cloud.database()
      console.log('[DB] 云开发初始化成功')
    } else {
      useCloud = false
      console.log('[DB] 云开发不可用，将使用本地存储')
    }
  } catch (err) {
    useCloud = false
    console.log('[DB] 云开发初始化失败，将使用本地存储', err)
  }
  
  initialized = true
}

// ==================== 本地存储操作（加密版）====================

/**
 * 从本地存储获取数据（解密）
 */
function getStorageData(key: string): any[] {
  try {
    const data = getEncryptedStorage(key)
    return data || []
  } catch (err) {
    console.error('[DB] 读取本地存储失败', err)
    return []
  }
}

/**
 * 保存数据到本地存储（加密）
 */
function setStorageData(key: string, data: any[]): boolean {
  try {
    return setEncryptedStorage(key, data)
  } catch (err) {
    console.error('[DB] 保存本地存储失败', err)
    return false
  }
}

// ==================== 同步状态管理 ====================

/**
 * 获取同步状态
 */
export function getSyncStatus(): SyncStatus {
  try {
    const status = getEncryptedStorage(STORAGE_KEYS.SYNC_STATUS)
    return status || {
      isSyncing: false,
      pendingItems: 0
    }
  } catch {
    return {
      isSyncing: false,
      pendingItems: 0
    }
  }
}

/**
 * 更新同步状态
 */
export function updateSyncStatus(status: Partial<SyncStatus>): void {
  const current = getSyncStatus()
  const newStatus = { ...current, ...status }
  setEncryptedStorage(STORAGE_KEYS.SYNC_STATUS, newStatus)
}

/**
 * 获取待同步数据
 */
function getPendingSync(): any[] {
  return getStorageData(STORAGE_KEYS.PENDING_SYNC)
}

/**
 * 添加待同步项
 */
function addPendingSync(item: any): void {
  const pending = getPendingSync()
  pending.push({
    ...item,
    addedTime: new Date().toISOString()
  })
  setStorageData(STORAGE_KEYS.PENDING_SYNC, pending)
  
  updateSyncStatus({
    pendingItems: pending.length
  })
}

// ==================== 集合封装 ====================

// 本地存储的集合类
class LocalCollection {
  key: string
  
  constructor(key: string) {
    this.key = key
  }
  
  add({ data }: { data: any }): Promise<{ _id: string }> {
    const items = getStorageData(this.key)
    const newItem = {
      ...data,
      _id: generateId(),
      _openid: 'local_user',
      createTime: new Date(),
      updateTime: new Date(),
      syncStatus: 'local'
    }
    items.push(newItem)
    setStorageData(this.key, items)
    
    // 添加到待同步队列
    addPendingSync({
      type: 'add',
      collection: this.key,
      data: newItem
    })
    
    return Promise.resolve({ _id: newItem._id })
  }
  
  get(): Promise<{ data: any[] }> {
    const items = getStorageData(this.key)
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

// 本地存储查询类
class LocalQuery {
  key: string
  query: any
  
  constructor(key: string, query: any) {
    this.key = key
    this.query = query
  }
  
  get(): Promise<{ data: any[] }> {
    const items = getStorageData(this.key)
    const filtered = items.filter(item => {
      for (const key in this.query) {
        if (item[key] !== this.query[key]) {
          return false
        }
      }
      return true
    })
    return Promise.resolve({ data: filtered })
  }
  
  orderBy(_field: string, _order: string): LocalQuery {
    return this
  }
}

// 本地存储文档类
class LocalDoc {
  key: string
  id: string
  
  constructor(key: string, id: string) {
    this.key = key
    this.id = id
  }
  
  update({ data }: { data: any }): Promise<any> {
    const items = getStorageData(this.key)
    const index = items.findIndex(item => item._id === this.id || item.groupId === this.id || item.cardId === this.id)
    if (index !== -1) {
      items[index] = { 
        ...items[index], 
        ...data, 
        updateTime: new Date(),
        syncStatus: 'pending'
      }
      setStorageData(this.key, items)
      
      // 添加到待同步队列
      addPendingSync({
        type: 'update',
        collection: this.key,
        id: this.id,
        data: data
      })
    }
    return Promise.resolve({})
  }
  
  remove(): Promise<any> {
    const items = getStorageData(this.key)
    const filtered = items.filter(item => item._id !== this.id && item.groupId !== this.id && item.cardId !== this.id)
    setStorageData(this.key, filtered)
    
    // 添加到待同步队列
    addPendingSync({
      type: 'remove',
      collection: this.key,
      id: this.id
    })
    
    return Promise.resolve({})
  }
  
  get(): Promise<{ data: any }> {
    const items = getStorageData(this.key)
    const item = items.find(item => item._id === this.id || item.groupId === this.id || item.cardId === this.id)
    return Promise.resolve({ data: item || null })
  }
}

// 创建集合实例
function createCollection(key: string): any {
  initDB()
  if (useCloud && db) {
    return db.collection(key)
  } else {
    return new LocalCollection(key)
  }
}

export const userCollection = createCollection('users')
export const cardGroupCollection = createCollection('cardGroups')
export const cardCollection = createCollection('cards')
export const studyRecordCollection = createCollection('studyRecords')
export const favoriteCollection = createCollection('favorites')
export const backupCollection = createCollection('backups')

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

/**
 * 获取当前用户的 openid
 */
export async function getUserId(): Promise<string> {
  initDB()
  if (!useCloud) {
    return 'local_user'
  }
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'user_login'
    })
    return (result as any).openid
  } catch (err) {
    console.error('[DB] 获取用户ID失败', err)
    return 'local_user'
  }
}

/**
 * 导出所有本地数据（用于备份）
 */
export function exportAllLocalData(): BackupData {
  return {
    version: '1.0',
    backupTime: new Date(),
    cardGroups: getStorageData(STORAGE_KEYS.CARD_GROUPS) as CardGroup[],
    cards: getStorageData(STORAGE_KEYS.CARDS) as Card[],
    studyRecords: getStorageData(STORAGE_KEYS.STUDY_RECORDS) as StudyRecord[],
    favorites: getStorageData(STORAGE_KEYS.FAVORITES) as Favorite[]
  }
}

/**
 * 导入数据到本地存储（用于恢复）
 */
export function importLocalData(data: BackupData): boolean {
  try {
    // 导入前先备份当前数据
    const currentData = exportAllLocalData()
    setEncryptedStorage('backup_before_import', currentData)
    
    // 导入新数据
    setStorageData(STORAGE_KEYS.CARD_GROUPS, data.cardGroups)
    setStorageData(STORAGE_KEYS.CARDS, data.cards)
    setStorageData(STORAGE_KEYS.STUDY_RECORDS, data.studyRecords)
    setStorageData(STORAGE_KEYS.FAVORITES, data.favorites)
    
    console.log('[DB] 数据导入成功')
    return true
  } catch (error) {
    console.error('[DB] 数据导入失败', error)
    return false
  }
}

/**
 * 获取本地存储使用情况
 */
export function getStorageInfo(): { used: number; limit: number } {
  try {
    const info = wx.getStorageInfoSync()
    return {
      used: info.currentSize,
      limit: info.limitSize
    }
  } catch {
    return {
      used: 0,
      limit: 10240
    }
  }
}

/**
 * 清除所有本地数据
 */
export function clearAllLocalData(): void {
  try {
    wx.clearStorageSync()
    console.log('[DB] 本地数据已清除')
  } catch (error) {
    console.error('[DB] 清除本地数据失败', error)
  }
}
