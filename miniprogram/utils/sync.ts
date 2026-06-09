import {
  getUserId,
  generateId,
  exportAllLocalData,
  importLocalData,
  getLocalStorageData,
  setLocalStorageData,
  getStorageInfo,
  clearAllLocalData,
  computeLocalHash
} from './db'
import type { BackupData, BackupRecord } from './types'
import { IAppOption } from './types'

const app = getApp<IAppOption>()
const BACKUP_STORAGE_KEY = 'backup_records'

class SyncManager {

  /**
   * 退出登录：清除所有本地数据
   */
  async onLogout(): Promise<void> {
    console.log('[Sync] 退出登录，清除本地数据')

    // 先在清空前读取需要保留的账户数据
    let preservedAccounts: any = null
    let preservedExtra: any = null
    try { preservedAccounts = wx.getStorageSync('savedAccounts') } catch (_) {}
    try { preservedExtra = wx.getStorageSync('saved_accounts_preserve') } catch (_) {}

    clearAllLocalData()

    // 清空后回写保留的账户数据
    if (preservedAccounts) {
      try { wx.setStorageSync('savedAccounts', preservedAccounts) } catch (_) {}
    }
    if (preservedExtra) {
      try {
        wx.setStorageSync('savedAccounts', preservedExtra)
        wx.removeStorageSync('saved_accounts_preserve')
      } catch (_) {}
    }

    app.globalData.userInfo = null
    console.log('[Sync] 退出登录完成')
  }

  /**
   * 同步数据到云端（哈希对比 → 有差异才上传）
   * 只保留一份云端备份，不做多版本快照
   */
  async syncToCloud(): Promise<{
    success: boolean
    message: string
  }> {
    try {
      const userId = await getUserId()
      if (userId === 'local_user') {
        return { success: false, message: '未登录或云开发不可用，请先登录' }
      }

      wx.showLoading({ title: '检查数据状态...' })

      // 1. 计算本地哈希
      const localHash = computeLocalHash()

      // 2. 获取云端备份信息，对比哈希
      try {
        const cloudInfo = await this.getLatestBackupInfo()
        if (cloudInfo.success && cloudInfo.hasBackup && cloudInfo.backupHash === localHash) {
          wx.hideLoading()
          // 更新同步时间，标记为已同步
          wx.setStorageSync('lastSyncHash', localHash)
          wx.setStorageSync('lastSyncTime', Date.now())
          return { success: true, message: '数据已同步，无需上传' }
        }
      } catch (_) {
        // 忽略错误，继续执行上传
      }

      // 3. 哈希不一致或无云端备份 → 执行上传
      wx.showLoading({ title: '同步中...' })

      const localData = exportAllLocalData()
      const dataStr = JSON.stringify(localData)

      const { result } = await wx.cloud.callFunction({
        name: 'backup_manager',
        data: {
          action: 'create',
          backupId: generateId(),
          backupData: localData,
          dataSize: dataStr.length,
          cardGroupsCount: localData.cardGroups.length,
          cardsCount: localData.cards.length,
          studyRecordsCount: localData.studyRecords.length,
          favoritesCount: localData.favorites.length
        }
      })

      const createResult = result as { success: boolean; error?: string }
      if (!createResult.success) {
        wx.hideLoading()
        return { success: false, message: createResult.error || '同步失败，请重试' }
      }

      // 4. 更新本地同步状态
      wx.setStorageSync('lastSyncHash', localHash)
      wx.setStorageSync('lastSyncTime', Date.now())
      wx.setStorageSync('lastBackupHash', localHash)
      wx.setStorageSync('lastBackupTime', new Date().toISOString())

      wx.hideLoading()
      return { success: true, message: '同步成功' }

    } catch (error: any) {
      wx.hideLoading()
      console.error('[Sync] 同步失败', error)
      return { success: false, message: '同步失败：' + (error.message || '未知错误') }
    }
  }

  /**
   * [已废弃] 保留旧方法引用，指向 syncToCloud
   * @deprecated 使用 syncToCloud 替代
   */
  async createBackup(_description?: string): Promise<{
    success: boolean
    message: string
    backupId?: string
  }> {
    const result = await this.syncToCloud()
    return { ...result, backupId: '' }
  }

  /**
   * 获取备份列表（优先云端）
   */
  async getBackupList(): Promise<BackupRecord[]> {
    try {
      const userId = await getUserId()
      if (userId === 'local_user') return []

      // 优先从云端获取
      try {
        const { result } = await wx.cloud.callFunction({
          name: 'backup_manager',
          data: { action: 'list' }
        })
        const listResult = result as { success: boolean; data?: any[] }
        if (listResult.success && listResult.data) {
          return listResult.data.map((item: any) => ({
            backupId: item.backupId,
            userId: item.userId || userId,
            backupTime: new Date(item.backupTime),
            dataSize: item.dataSize,
            description: item.description,
            cardGroupsCount: item.cardGroupsCount,
            cardsCount: item.cardsCount,
            studyRecordsCount: item.studyRecordsCount,
            favoritesCount: item.favoritesCount
          }))
        }
      } catch (err: any) {
        console.warn('[Sync] 云端获取备份列表失败，降级本地', err)
      }

      // 降级到本地
      const backups = getLocalStorageData(BACKUP_STORAGE_KEY)
      return backups
        .filter((item: any) => item.userId === userId)
        .sort((a: any, b: any) => new Date(b.backupTime).getTime() - new Date(a.backupTime).getTime())
        .map((item: any) => ({
          backupId: item.backupId,
          userId: item.userId,
          backupTime: new Date(item.backupTime),
          dataSize: item.dataSize,
          description: item.description,
          cardGroupsCount: item.cardGroupsCount,
          cardsCount: item.cardsCount,
          studyRecordsCount: item.studyRecordsCount,
          favoritesCount: item.favoritesCount
        }))
    } catch (error) {
      console.error('[Sync] 获取备份列表失败', error)
      return []
    }
  }

  /**
   * 从备份节点恢复数据
   */
  async restoreFromBackup(backupId: string): Promise<{
    success: boolean
    message: string
  }> {
    try {
      const userId = await getUserId()
      if (userId === 'local_user') {
        return { success: false, message: '需要先登录才能恢复备份' }
      }

      wx.showLoading({ title: '恢复中...' })

      let backupData: BackupData | null = null
      let source = ''

      // 1. 从云端获取备份数据
      try {
        const { result } = await wx.cloud.callFunction({
          name: 'backup_manager',
          data: { action: 'get', backupId }
        })
        const getResult = result as { success: boolean; data?: any; error?: string }
        if (getResult.success && getResult.data) {
          backupData = getResult.data.backupData as BackupData
          source = '云端'
        }
      } catch (err: any) {
        console.warn('[Sync] 云端获取备份失败，尝试本地', err)
      }

      // 2. 降级到本地
      if (!backupData) {
        const backups = getLocalStorageData(BACKUP_STORAGE_KEY)
        const found = backups.find((item: any) =>
          item.backupId === backupId && item.userId === userId
        )
        if (found) {
          backupData = found.backupData as BackupData
          source = '本地缓存'
        }
      }

      if (!backupData) {
        wx.hideLoading()
        return { success: false, message: '备份不存在（云端和本地均未找到）' }
      }

      // 3. 验证备份数据结构
      if (!backupData || typeof backupData !== 'object') {
        wx.hideLoading()
        return { success: false, message: '备份数据格式无效' }
      }
      if (!Array.isArray(backupData.cardGroups)) {
        wx.hideLoading()
        return { success: false, message: '备份数据缺少 cardGroups' }
      }
      if (!Array.isArray(backupData.cards)) {
        wx.hideLoading()
        return { success: false, message: '备份数据缺少 cards' }
      }

      // 4. 导入到本地
      importLocalData(backupData)

      // 更新备份时间戳和哈希（使恢复后的数据被视为已同步）
      const localHash = computeLocalHash()
      wx.setStorageSync('lastBackupHash', localHash)
      wx.setStorageSync('lastBackupTime', new Date().toISOString())
      wx.setStorageSync('lastSyncHash', localHash)
      wx.setStorageSync('lastRestoreTime', new Date().toISOString())

      wx.hideLoading()

      return { success: true, message: '恢复成功（来源：' + source + '）' }

    } catch (error) {
      wx.hideLoading()
      console.error('[Sync] 恢复失败', error)
      return { success: false, message: '恢复失败：' + (error instanceof Error ? error.message : '未知错误') }
    }
  }

  /**
   * 删除备份（云端+本地）
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const userId = await getUserId()
      if (userId === 'local_user') return false

      // 删除云端
      try {
        await wx.cloud.callFunction({
          name: 'backup_manager',
          data: { action: 'delete', backupId }
        })
      } catch (err: any) {
        console.warn('[Sync] 云端删除备份失败', err)
      }

      // 删除本地
      const backups = getLocalStorageData(BACKUP_STORAGE_KEY)
      const filtered = backups.filter((item: any) =>
        !(item.backupId === backupId && item.userId === userId)
      )
      if (filtered.length !== backups.length) {
        setLocalStorageData(BACKUP_STORAGE_KEY, filtered)
      }

      return true
    } catch (error) {
      console.error('[Sync] 删除备份失败', error)
      return false
    }
  }

  /**
   * 获取存储使用情况
   */
  getStorageUsage() {
    return getStorageInfo()
  }

  // ==================== 备份状态检查（含云端对比+缓存） ====================

  private CACHE_TTL = 300000 // 5 分钟缓存

  /**
   * 计算本地数据哈希
   */
  computeLocalHash(): string {
    return computeLocalHash()
  }

  /**
   * 从云端获取最新备份信息（backupHash, backupTime）
   */
  async getLatestBackupInfo(): Promise<{
    success: boolean
    hasBackup?: boolean
    backupTime?: string | null
    backupHash?: string | null
    errMsg?: string
  }> {
    try {
      const userId = await getUserId()
      if (userId === 'local_user') {
        return { success: false, errMsg: '云开发不可用' }
      }

      const { result } = await wx.cloud.callFunction({
        name: 'backup_manager',
        data: { action: 'getBackupInfo', userId }
      })

      const res = result as any
      if (res && res.success) {
        return {
          success: true,
          hasBackup: !!res.hasBackup,
          backupTime: (res.data?.backupTime as string) || null,
          backupHash: (res.data?.backupHash as string) || null
        }
      }
      return { success: false, errMsg: (res && res.error) || '获取备份信息失败' }
    } catch (err: any) {
      console.error('[Sync] 获取备份信息失败', err)
      return { success: false, errMsg: (err as Error).message }
    }
  }

  /**
   * 判断是否需要刷新缓存
   */
  shouldRefreshCache(lastCloudCheckTime: number, lastSyncHash: string): boolean {
    const now = Date.now()
    // 本地数据是否有变动
    const localHash = computeLocalHash()
    if (lastSyncHash && localHash !== lastSyncHash) return true
    // 缓存过期则刷新
    if (now - lastCloudCheckTime > this.CACHE_TTL) return true
    return false
  }

  /**
   * 本地哈希短路径：本地无变化且缓存未过期 → 直接使用缓存
   */
  tryLocalHashShortCircuit(lastCloudCheckTime: number, lastSyncHash: string, cachedCloudStatus: any): boolean {
    const localHash = computeLocalHash()
    if (lastSyncHash && localHash === lastSyncHash) {
      if (cachedCloudStatus && (Date.now() - lastCloudCheckTime < this.CACHE_TTL)) {
        return true
      }
      return false
    }
    return false
  }

  /**
   * 根据缓存和本地/云端信息判断备份状态
   */
  updateBackupStatusUI(
    cache: { status: string; time: string | null; hash: string | null },
    lastSyncHash: string,
    lastSyncTime: number,
    lastLocalUpdate: number
  ): { type: string; label: string } {
    if (!cache || cache.status === 'no_backup') {
      return { type: 'unbacked', label: '未备份' }
    }

    const localHash = computeLocalHash()
    const cloudHash = cache.hash || ''
    const cloudBackupTime = cache.time ? new Date(cache.time).getTime() : 0

    // 本地哈希与上次同步哈希一致 → 已同步
    if (lastSyncHash && localHash === lastSyncHash) {
      const syncTime = lastSyncTime || cloudBackupTime || lastLocalUpdate
      const syncTimeStr = syncTime ? this.formatBackupTime(new Date(syncTime).toISOString()) : ''
      return { type: 'synced', label: '已同步' + (syncTimeStr ? ' ' + syncTimeStr : '') }
    }

    // 本地哈希与云端哈希一致 → 已同步
    if (cloudHash && localHash === cloudHash) {
      const syncTime = lastSyncTime || cloudBackupTime || lastLocalUpdate
      const syncTimeStr = syncTime ? this.formatBackupTime(new Date(syncTime).toISOString()) : ''
      return { type: 'synced', label: '已同步' + (syncTimeStr ? ' ' + syncTimeStr : '') }
    }

    const localTimeStr = lastLocalUpdate ? this.formatBackupTime(new Date(lastLocalUpdate).toISOString()) : ''
    const cloudTimeStr = cache.time ? this.formatBackupTime(cache.time) : ''

    if (!cache.time || (cloudBackupTime && lastLocalUpdate > cloudBackupTime)) {
      return { type: 'local_newer', label: '本地最新' + (localTimeStr ? ' ' + localTimeStr : '') }
    } else {
      return { type: 'cloud_newer', label: '云端最新' + (cloudTimeStr ? ' ' + cloudTimeStr : '') }
    }
  }

  /**
   * 获取云端存储用量
   */
  async getCloudStorageInfo(): Promise<{
    success: boolean
    totalSize: number
    backupCount: number
  }> {
    try {
      const userId = await getUserId()
      if (userId === 'local_user') {
        return { success: false, totalSize: 0, backupCount: 0 }
      }

      const { result } = await wx.cloud.callFunction({
        name: 'backup_manager',
        data: { action: 'getCloudStorageInfo', userId }
      })

      const res = result as any
      if (res && res.success && res.data) {
        return {
          success: true,
          totalSize: res.data.totalSize || 0,
          backupCount: res.data.backupCount || 0
        }
      }
      return { success: false, totalSize: 0, backupCount: 0 }
    } catch (err: any) {
      console.error('[Sync] 获取云端存储信息失败', err)
      return { success: false, totalSize: 0, backupCount: 0 }
    }
  }

  /**
   * 格式化备份时间 → "MM-DD HH:mm"
   */
  formatBackupTime(isoString: string): string {
    if (!isoString) return ''
    const date = new Date(isoString)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hh = date.getHours().toString().padStart(2, '0')
    const mm = date.getMinutes().toString().padStart(2, '0')
    return month + '-' + day + ' ' + hh + ':' + mm
  }
}

export const syncManager = new SyncManager()
