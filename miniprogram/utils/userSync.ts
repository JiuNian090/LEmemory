/**
 * 用户资料多端同步服务
 * 负责在多个设备之间同步用户昵称、头像等资料
 *
 * 同步策略（基于哈希对比，避免无效下载）：
 * - 每次页面加载时，先从本地缓存头像（立即可用）
 * - 异步从云端拉取用户资料的 avatarHash
 * - 比较本地缓存哈希与云端哈希：
 *   - 相同：不做任何操作，继续使用本地缓存
 *   - 不同：云端有新头像 → 下载到本地缓存，更新哈希
 * - 头像更新时（settings）：上传云端 → 计算文件哈希 → 一起存入云端
 */

import type { IAppOption, User } from './types'

const app = getApp<IAppOption>()

/** 本地头像缓存路径 */
const AVATAR_CACHE_PATH_KEY = 'cachedAvatarPath'
/** 本地头像哈希（用于快速对比是否变化） */
const AVATAR_CACHE_HASH_KEY = 'cachedAvatarHash'
/** 本地记录的头像云 fileID（用于显示云端头像） */
const AVATAR_CLOUD_ID_KEY = 'cachedAvatarCloudId'

let syncing = false

/**
 * 计算字符串哈希（与备份系统一致）
 */
function computeHash(data: string): string {
  if (!data) return ''
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(36)
}

/**
 * 从云端同步用户资料（哈希对比，缓存优先）
 *
 * 执行流程：
 * 1. 从云端获取最新用户资料（含 avatarHash）
 * 2. 比较 avatarHash 与本地缓存的哈希
 * 3. 哈希一致 → 继续使用本地缓存，不做下载
 * 4. 哈希不一致 → 云端有新头像 → 下载并更新本地缓存
 *
 * @returns 是否发生了变更
 */
export async function syncUserProfile(): Promise<boolean> {
  if (syncing) return false
  syncing = true

  try {
    const localUser: User | null = wx.getStorageSync('userInfo') || null
    if (!localUser?._openid) return false

    const { result } = await wx.cloud.callFunction({
      name: 'account_manager',
      data: { action: 'getUser' }
    })

    const res = result as { success: boolean; user?: any; error?: string }
    if (!res.success || !res.user) return false

    const cloudUser = res.user
    let changed = false

    // 1. 同步昵称
    if (cloudUser.nickName && cloudUser.nickName !== localUser.nickName) {
      localUser.nickName = cloudUser.nickName
      changed = true
    }

    // 2. 同步头像（哈希对比）
    const cloudHash = cloudUser.avatarHash || ''
    const localHash: string = wx.getStorageSync(AVATAR_CACHE_HASH_KEY) || ''

    if (cloudHash && cloudHash !== localHash) {
      // 云端有新头像且本地缓存不一致 → 下载新头像
      const localPath = await downloadCloudAvatar(cloudUser.avatarUrl)
      if (localPath) {
        localUser.avatarLocalPath = localPath
        wx.setStorageSync(AVATAR_CACHE_PATH_KEY, localPath)
        wx.setStorageSync(AVATAR_CACHE_HASH_KEY, cloudHash)
        wx.setStorageSync(AVATAR_CLOUD_ID_KEY, cloudUser.avatarUrl || '')
      }
      localUser.avatarUrl = cloudUser.avatarUrl || ''
      changed = true
    } else if (cloudHash && cloudHash === localHash) {
      // 哈希一致，但本地路径可能丢失 → 用缓存的 fileID 填充
      if (!localUser.avatarLocalPath) {
        const cachedPath: string = wx.getStorageSync(AVATAR_CACHE_PATH_KEY) || ''
        localUser.avatarLocalPath = cachedPath
      }
      if (cloudUser.avatarUrl !== localUser.avatarUrl) {
        // 只是 fileID 变了但内容没变（相同图片重新上传），更新 fileID 即可
        localUser.avatarUrl = cloudUser.avatarUrl
        wx.setStorageSync(AVATAR_CLOUD_ID_KEY, cloudUser.avatarUrl || '')
        changed = true
      }
    } else if (!cloudHash && localUser.avatarUrl) {
      // 云端头像被清空
      clearUserAvatarCache()
      localUser.avatarUrl = ''
      localUser.avatarLocalPath = ''
      changed = true
    }

    // 3. 同步其他字段
    if (cloudUser.username && cloudUser.username !== localUser.username) {
      localUser.username = cloudUser.username
      changed = true
    }

    if (changed) {
      localUser.lastSyncTime = new Date()
      wx.setStorageSync('userInfo', localUser)
      app.globalData.userInfo = localUser
    }

    return changed
  } catch (err: any) {
    console.warn('[UserSync] 同步用户资料失败', err)
    return false
  } finally {
    syncing = false
  }
}

/**
 * 从云端下载头像到本地缓存
 */
async function downloadCloudAvatar(fileID: string): Promise<string | null> {
  if (!fileID) return null

  try {
    // 将 cloud fileID 转为可下载的临时 URL
    const { fileList } = await wx.cloud.getTempFileURL({
      fileList: [fileID]
    })

    const tempUrl = fileList?.[0]?.tempFileURL || fileID
    if (!tempUrl) return null

    // 下载到临时文件
    const downloadResult = await new Promise<WechatMiniprogram.DownloadFileSuccessCallbackResult>((resolve, reject) => {
      wx.downloadFile({
        url: tempUrl,
        success: resolve,
        fail: reject
      })
    })

    // 保存为永久缓存文件
    const fs = wx.getFileSystemManager()
    const savedPath = `${wx.env.USER_DATA_PATH}/le_avatar_cache_${Date.now()}.jpg`
    fs.saveFileSync(downloadResult.tempFilePath, savedPath)

    // 清除旧的头像缓存文件
    cleanupOldAvatarCache(savedPath)

    return savedPath
  } catch (err: any) {
    console.warn('[UserSync] 下载头像失败', err)
    return null
  }
}

/**
 * 更新头像后，缓存头像到本地并记录哈希
 * 在 settings.ts updateAvatar 的末尾调用
 */
export function cacheLocalAvatar(
  tempFilePath: string,
  cloudFileID: string,
  cloudHash: string
): string | null {
  try {
    const fs = wx.getFileSystemManager()
    const savedPath = `${wx.env.USER_DATA_PATH}/le_avatar_cache_local_${Date.now()}.jpg`
    fs.saveFileSync(tempFilePath, savedPath)

    // 更新本地缓存标记
    wx.setStorageSync(AVATAR_CACHE_PATH_KEY, savedPath)
    wx.setStorageSync(AVATAR_CACHE_HASH_KEY, cloudHash)
    wx.setStorageSync(AVATAR_CLOUD_ID_KEY, cloudFileID)

    // 清除旧的缓存文件
    cleanupOldAvatarCache(savedPath)

    return savedPath
  } catch (err: any) {
    console.warn('[UserSync] 缓存本地头像失败', err)
    return null
  }
}

/**
 * 获取当前最佳的头像显示路径
 * 优先返回本地缓存路径（立即可用、离线可用），其次返回云端 fileID，最后返回默认图
 */
export function getBestAvatarUrl(user: User | null): string {
  if (!user) return '/images/me.png'

  if (user.avatarLocalPath) {
    return user.avatarLocalPath
  }

  if (user.avatarUrl) {
    return user.avatarUrl
  }

  return '/images/me.png'
}

/**
 * 清除用户头像缓存
 */
export function clearUserAvatarCache(): void {
  const cachedPath: string = wx.getStorageSync(AVATAR_CACHE_PATH_KEY) || ''
  if (cachedPath) {
    try {
      const fs = wx.getFileSystemManager()
      fs.unlinkSync(cachedPath)
    } catch { /* ignore */ }
  }
  wx.removeStorageSync(AVATAR_CACHE_PATH_KEY)
  wx.removeStorageSync(AVATAR_CACHE_HASH_KEY)
  wx.removeStorageSync(AVATAR_CLOUD_ID_KEY)
}

/**
 * 清除旧的头像缓存文件（保留最新的）
 */
function cleanupOldAvatarCache(currentPath: string): void {
  try {
    const fs = wx.getFileSystemManager()
    const oldPath: string = wx.getStorageSync(AVATAR_CACHE_PATH_KEY) || ''
    if (oldPath && oldPath !== currentPath) {
      try { fs.unlinkSync(oldPath) } catch { /* 文件可能已被删除 */ }
    }
  } catch { /* ignore */ }
}

/**
 * 从文件内容计算哈希（用于 settings.ts 上传头像时）
 * 读取文件为 base64，计算与备份系统一致的哈希值
 */
export function computeFileHashFromPath(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager()
    fs.readFile({
      filePath,
      encoding: 'base64',
      success: (res) => {
        const base64 = res.data as string
        resolve(computeHash(base64))
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}