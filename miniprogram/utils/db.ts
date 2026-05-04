import { setEncryptedStorage, getEncryptedStorage } from './crypto'
import type { CardGroup, Card, StudyRecord, Favorite, BackupData, SyncStatus } from './types'

let cloudDb: any = null
let cloudAvailable = false
let initialized = false

const STORAGE_KEYS = {
  CARD_GROUPS: 'card_groups',
  CARDS: 'cards',
  FAVORITES: 'favorites',
  STUDY_RECORDS: 'study_records',
  SYNC_STATUS: 'sync_status',
  PENDING_SYNC: 'pending_sync'
}

function initDB() {
  if (initialized) return
  try {
    if (wx.cloud) {
      cloudDb = wx.cloud.database()
      cloudAvailable = true
      console.log('[DB] 云开发初始化成功')
    } else {
      console.log('[DB] 云开发不可用，将使用本地存储')
    }
  } catch (err) {
    console.log('[DB] 云开发初始化失败，将使用本地存储', err)
  }
  initialized = true
}

function isCloudReady(): boolean {
  initDB()
  return cloudAvailable && !!cloudDb
}

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

// ==================== 同步状态管理 ====================

export function getSyncStatus(): SyncStatus {
  try {
    const status = getEncryptedStorage(STORAGE_KEYS.SYNC_STATUS)
    return status || { isSyncing: false, pendingItems: 0 }
  } catch {
    return { isSyncing: false, pendingItems: 0 }
  }
}

export function updateSyncStatus(status: Partial<SyncStatus>): void {
  const current = getSyncStatus()
  const newStatus = { ...current, ...status }
  setEncryptedStorage(STORAGE_KEYS.SYNC_STATUS, newStatus)
}

function getPendingSync(): any[] {
  return getLocalStorageData(STORAGE_KEYS.PENDING_SYNC)
}

function addPendingSync(item: any): void {
  const pending = getPendingSync()
  pending.push({ ...item, addedTime: new Date().toISOString() })
  setLocalStorageData(STORAGE_KEYS.PENDING_SYNC, pending)
  updateSyncStatus({ pendingItems: pending.length })
}

// ==================== 生成唯一ID ====================

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

// ==================== 本地集合类（纯本地操作） ====================

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
      _openid: data._openid || 'local_user',
      createTime: data.createTime || new Date(),
      updateTime: new Date(),
      syncStatus: 'local'
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
      items[index] = { ...items[index], ...data, updateTime: new Date(), syncStatus: 'pending' }
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
      items[index] = { ...items[index], ...options.data, updateTime: new Date(), syncStatus: 'local' }
    } else {
      const newItem = { ...options.data, _id: this.id, updateTime: new Date(), syncStatus: 'local' }
      items.push(newItem)
    }
    setLocalStorageData(this.key, items)
    return Promise.resolve({})
  }
}

// ==================== 双写集合类（本地 + 云端实时同步） ====================

class DualCollection {
  key: string
  cloudCollection: any

  constructor(key: string) {
    this.key = key
    initDB()
    if (isCloudReady()) {
      this.cloudCollection = cloudDb.collection(key)
    }
  }

  private getLocal(): LocalCollection {
    return new LocalCollection(this.key)
  }

  async add({ data }: { data: any }): Promise<{ _id: string }> {
    const localResult = await this.getLocal().add({ data })
    if (this.cloudCollection) {
      try {
        await this.cloudCollection.add({
          data: {
            ...data,
            _id: localResult._id,
            updateTime: new Date(),
            syncStatus: 'synced'
          }
        })
      } catch (err) {
        console.warn(`[DB] 云端写入 ${this.key} 失败，已加入待同步`, err)
        addPendingSync({ type: 'add', collection: this.key, data: { ...data, _id: localResult._id } })
      }
    }
    return localResult
  }

  async get(): Promise<{ data: any[] }> {
    if (this.cloudCollection) {
      try {
        const result = await this.cloudCollection.get()
        return result
      } catch (err) {
        console.warn(`[DB] 云端读取 ${this.key} 失败，降级到本地`, err)
      }
    }
    return this.getLocal().get()
  }

  orderBy(field: string, order: string): DualCollection {
    if (this.cloudCollection) {
      this.cloudCollection = this.cloudCollection.orderBy(field, order)
    }
    return this
  }

  where(query: any): DualQuery {
    return new DualQuery(this.key, this.cloudCollection ? this.cloudCollection.where(query) : null, query)
  }

  doc(id: string): DualDoc {
    return new DualDoc(this.key, id, this.cloudCollection)
  }

  limit(n: number): DualCollection {
    if (this.cloudCollection) {
      this.cloudCollection = this.cloudCollection.limit(n)
    }
    return this
  }
}

class DualQuery {
  key: string
  cloudQuery: any
  query: any

  constructor(key: string, cloudQuery: any, query: any) {
    this.key = key
    this.cloudQuery = cloudQuery
    this.query = query
  }

  async get(): Promise<{ data: any[] }> {
    if (this.cloudQuery) {
      try {
        const result = await this.cloudQuery.get()
        return result
      } catch (err) {
        console.warn(`[DB] 云端查询 ${this.key} 失败，降级到本地`, err)
      }
    }
    return new LocalQuery(this.key, this.query).get()
  }

  orderBy(field: string, order: string): DualQuery {
    if (this.cloudQuery) {
      this.cloudQuery = this.cloudQuery.orderBy(field, order)
    }
    return this
  }
}

class DualDoc {
  key: string
  id: string
  cloudCollection: any

  constructor(key: string, id: string, cloudCollection: any) {
    this.key = key
    this.id = id
    this.cloudCollection = cloudCollection
  }

  async update({ data }: { data: any }): Promise<any> {
    const localDoc = new LocalDoc(this.key, this.id)
    await localDoc.update({ data })
    if (this.cloudCollection) {
      try {
        const { data: cloudDocs } = await this.cloudCollection
          .where({
            _id: this.id
          })
          .limit(1)
          .get()
        if (cloudDocs.length > 0) {
          await this.cloudCollection.doc(cloudDocs[0]._id).update({ data })
        }
      } catch (err) {
        console.warn(`[DB] 云端更新 ${this.key} 失败`, err)
        addPendingSync({ type: 'update', collection: this.key, id: this.id, data })
      }
    }
    return {}
  }

  async remove(): Promise<any> {
    const localDoc = new LocalDoc(this.key, this.id)
    await localDoc.remove()
    if (this.cloudCollection) {
      try {
        const { data: cloudDocs } = await this.cloudCollection
          .where({
            _id: this.id
          })
          .limit(1)
          .get()
        if (cloudDocs.length > 0) {
          await this.cloudCollection.doc(cloudDocs[0]._id).remove()
        }
      } catch (err) {
        console.warn(`[DB] 云端删除 ${this.key} 失败`, err)
        addPendingSync({ type: 'remove', collection: this.key, id: this.id })
      }
    }
    return {}
  }

  async get(): Promise<{ data: any }> {
    if (this.cloudCollection) {
      try {
        const { data: cloudDocs } = await this.cloudCollection
          .where({
            _id: this.id
          })
          .limit(1)
          .get()
        if (cloudDocs.length > 0) return { data: cloudDocs[0] }
      } catch (err) {
        console.warn(`[DB] 云端读取文档 ${this.key} 失败`, err)
      }
    }
    return new LocalDoc(this.key, this.id).get()
  }

  async set(options: { data: any }): Promise<any> {
    const localDoc = new LocalDoc(this.key, this.id)
    await localDoc.set(options)
    if (this.cloudCollection) {
      try {
        const { data: cloudDocs } = await this.cloudCollection
          .where({
            _id: this.id
          })
          .limit(1)
          .get()
        if (cloudDocs.length > 0) {
          await this.cloudCollection.doc(cloudDocs[0]._id).set({ data: options.data })
        } else {
          await this.cloudCollection.add({ data: { ...options.data, _id: this.id } })
        }
      } catch (err) {
        console.warn(`[DB] 云端 set ${this.key} 失败`, err)
      }
    }
    return {}
  }
}

// ==================== 导出集合实例（始终双写） ====================

export const userCollection = new DualCollection('users')
export const cardGroupCollection = new DualCollection('cardGroups')
export const cardCollection = new DualCollection('cards')
export const studyRecordCollection = new DualCollection('studyRecords')
export const favoriteCollection = new DualCollection('favorites')
export const backupCollection = new DualCollection('backups')

// ==================== 用户身份 ====================

export async function getUserId(): Promise<string> {
  initDB()
  if (!isCloudReady()) return 'local_user'
  try {
    const { result } = await wx.cloud.callFunction({ name: 'user_login' })
    return (result as any).openid
  } catch (err) {
    console.error('[DB] 获取用户ID失败', err)
    return 'local_user'
  }
}

// ==================== 数据导入/导出 ====================

export function exportAllLocalData(): BackupData {
  return {
    version: '1.0',
    backupTime: new Date(),
    cardGroups: getLocalStorageData(STORAGE_KEYS.CARD_GROUPS) as CardGroup[],
    cards: getLocalStorageData(STORAGE_KEYS.CARDS) as Card[],
    studyRecords: getLocalStorageData(STORAGE_KEYS.STUDY_RECORDS) as StudyRecord[],
    favorites: getLocalStorageData(STORAGE_KEYS.FAVORITES) as Favorite[]
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

// ==================== 清除所有本地数据 ====================

export function clearAllLocalData(): void {
  try {
    wx.clearStorageSync()
    console.log('[DB] 所有本地数据已清除')
  } catch (error) {
    console.error('[DB] 清除本地数据失败', error)
  }
}

// ==================== 云端数据操作 ====================

export async function clearCloudUserData(userId: string): Promise<void> {
  if (!isCloudReady()) return
  const collections = ['cardGroups', 'cards', 'studyRecords', 'favorites']
  for (const name of collections) {
    try {
      const { data } = await cloudDb.collection(name).where({ userId }).get()
      for (const doc of data) {
        await cloudDb.collection(name).doc(doc._id).remove()
      }
    } catch (err) {
      console.warn(`[DB] 清除云端 ${name} 失败`, err)
    }
  }
}

export async function uploadAllLocalToCloud(userId: string): Promise<number> {
  if (!isCloudReady()) return 0
  const localData = exportAllLocalData()
  let count = 0

  const collections: { key: string; data: any[]; cloudName: string }[] = [
    { key: STORAGE_KEYS.CARD_GROUPS, data: localData.cardGroups, cloudName: 'cardGroups' },
    { key: STORAGE_KEYS.CARDS, data: localData.cards, cloudName: 'cards' },
    { key: STORAGE_KEYS.STUDY_RECORDS, data: localData.studyRecords, cloudName: 'studyRecords' },
    { key: STORAGE_KEYS.FAVORITES, data: localData.favorites, cloudName: 'favorites' }
  ]

  for (const { data, cloudName } of collections) {
    for (const item of data) {
      try {
        await cloudDb.collection(cloudName).add({
          data: { ...item, userId, _openid: userId, syncStatus: 'synced' }
        })
        count++
      } catch (err) {
        console.warn(`[DB] 上传 ${cloudName} 失败`, err)
      }
    }
  }

  return count
}

export async function downloadCloudToLocal(userId: string): Promise<number> {
  if (!isCloudReady()) return 0
  try {
    const [
      { data: cardGroups },
      { data: cards },
      { data: studyRecords },
      { data: favorites }
    ] = await Promise.all([
      cloudDb.collection('cardGroups').where({ userId }).get(),
      cloudDb.collection('cards').where({ userId }).get(),
      cloudDb.collection('studyRecords').where({ userId }).get(),
      cloudDb.collection('favorites').where({ userId }).get()
    ])

    importLocalData({
      version: '1.0',
      backupTime: new Date(),
      userId,
      cardGroups: cardGroups as CardGroup[],
      cards: cards as Card[],
      studyRecords: studyRecords as StudyRecord[],
      favorites: favorites as Favorite[]
    })

    return cardGroups.length + cards.length + studyRecords.length + favorites.length
  } catch (err) {
    console.error('[DB] 下载云端数据失败', err)
    return 0
  }
}
