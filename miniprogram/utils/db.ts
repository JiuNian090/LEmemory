// 延迟初始化，确保 app.ts 中的 wx.cloud.init 先执行
let db: any = null
let useCloud = true
let initialized = false

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

// 本地存储键名
const STORAGE_KEYS = {
  CARD_GROUPS: 'card_groups',
  CARDS: 'cards',
  FAVORITES: 'favorites'
}

// ==================== 本地存储操作 ====================

/**
 * 从本地存储获取数据
 */
function getStorageData(key: string): any[] {
  try {
    const data = wx.getStorageSync(key)
    return data || []
  } catch (err) {
    console.error('[DB] 读取本地存储失败', err)
    return []
  }
}

/**
 * 保存数据到本地存储
 */
function setStorageData(key: string, data: any[]): void {
  try {
    wx.setStorageSync(key, data)
  } catch (err) {
    console.error('[DB] 保存本地存储失败', err)
  }
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
      updateTime: new Date()
    }
    items.push(newItem)
    setStorageData(this.key, items)
    return Promise.resolve({ _id: newItem._id })
  }
  
  get(): Promise<{ data: any[] }> {
    const items = getStorageData(this.key)
    return Promise.resolve({ data: items })
  }
  
  orderBy(field: string, order: string): LocalCollection {
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
  
  orderBy(field: string, order: string): LocalQuery {
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
    const index = items.findIndex(item => item._id === this.id || item.groupId === this.id)
    if (index !== -1) {
      items[index] = { ...items[index], ...data, updateTime: new Date() }
      setStorageData(this.key, items)
    }
    return Promise.resolve({})
  }
  
  remove(): Promise<any> {
    const items = getStorageData(this.key)
    const filtered = items.filter(item => item._id !== this.id && item.groupId !== this.id)
    setStorageData(this.key, filtered)
    return Promise.resolve({})
  }
  
  get(): Promise<{ data: any }> {
    const items = getStorageData(this.key)
    const item = items.find(item => item._id === this.id || item.groupId === this.id)
    return Promise.resolve({ data: item || null })
  }
}

// 创建集合实例
function createCollection(key: string): any {
  initDB() // 确保先初始化
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
