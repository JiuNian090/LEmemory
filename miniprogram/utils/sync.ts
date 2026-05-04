import {
  getUserId,
  generateId,
  exportAllLocalData,
  importLocalData,
  updateSyncStatus,
  getLocalStorageData,
  setLocalStorageData,
  getStorageInfo,
  downloadCloudToLocal,
  uploadAllLocalToCloud
} from './db'
import type { BackupData, BackupRecord } from './types'
import { IAppOption } from './types'

const app = getApp<IAppOption>()
const BACKUP_STORAGE_KEY = 'backup_records'

class SyncManager {

  /**
   * 登录后执行账号关联和数据同步
   * 策略：云端为主，下载到本地覆盖
   */
  async linkAccountAndSync(): Promise<{
    success: boolean
    message: string
    syncedCount: number
  }> {
    console.log('[Sync] 开始账号关联和数据同步')

    try {
      const userId = await getUserId()
      if (userId === 'local_user') {
        return { success: false, message: '云开发不可用，请检查网络连接', syncedCount: 0 }
      }

      updateSyncStatus({ isSyncing: true })

      // 登录时：从云端下载所有数据到本地
      const syncedCount = await downloadCloudToLocal(userId)

      updateSyncStatus({
        isSyncing: false,
        lastSyncTime: new Date(),
        pendingItems: 0,
        lastError: undefined
      })

      return {
        success: true,
        message: syncedCount > 0 ? `已从云端恢复 ${syncedCount} 条数据` : '云端暂无数据',
        syncedCount
      }

    } catch (error) {
      console.error('[Sync] 同步失败', error)
      updateSyncStatus({
        isSyncing: false,
        lastError: error instanceof Error ? error.message : '未知错误'
      })
      return {
        success: false,
        message: '同步失败：' + (error instanceof Error ? error.message : '未知错误'),
        syncedCount: 0
      }
    }
  }

  /**
   * 退出登录：清除所有本地数据
   */
  async onLogout(): Promise<void> {
    console.log('[Sync] 退出登录，清除本地数据')
    try {
      const userId = await getUserId()
      if (userId !== 'local_user') {
        await uploadAllLocalToCloud(userId)
        console.log('[Sync] 本地数据已同步至云端')
      }
    } catch (err) {
      console.warn('[Sync] 退出时同步云端失败', err)
    }

    // 清除所有本地存储
    try {
      wx.clearStorageSync()
    } catch (err) {
      console.error('[Sync] 清除本地数据失败', err)
    }

    // 恢复记住的账号
    try {
      const preserved = wx.getStorageSync('saved_accounts_preserve')
      if (preserved) {
        wx.setStorageSync('savedAccounts', preserved)
        wx.removeStorageSync('saved_accounts_preserve')
      }
    } catch (_) {}

    app.globalData.userInfo = null
    console.log('[Sync] 退出登录完成')
  }

  /**
   * 在云端创建备份节点
   */
  async createBackup(description?: string): Promise<{
    success: boolean
    message: string
    backupId?: string
  }> {
    try {
      const userId = await getUserId()
      if (userId === 'local_user') {
        return { success: false, message: '需要先登录才能备份' }
      }

      wx.showLoading({ title: '备份中...' })

      const localData = exportAllLocalData()
      const dataJson = JSON.stringify(localData)
      const dataSize = dataJson.length

      const backupId = generateId()

      // 1. 上传到云端备份集合
      try {
        const { result } = await wx.cloud.callFunction({
          name: 'backup_manager',
          data: {
            action: 'create',
            backupId,
            description: description || '',
            backupData: localData,
            dataSize,
            cardGroupsCount: localData.cardGroups.length,
            cardsCount: localData.cards.length,
            studyRecordsCount: localData.studyRecords.length,
            favoritesCount: localData.favorites.length
          }
        })
        const createResult = result as { success: boolean; error?: string }
        if (!createResult.success) {
          wx.hideLoading()
          return { success: false, message: createResult.error || '云端备份失败' }
        }
      } catch (err) {
        console.warn('[Sync] 云端备份失败，降级本地', err)
      }

      // 2. 本地也存一份副本
      const backups = getLocalStorageData(BACKUP_STORAGE_KEY)
      backups.push({
        backupId,
        userId,
        backupTime: new Date().toISOString(),
        dataSize,
        description: description || '',
        cardGroupsCount: localData.cardGroups.length,
        cardsCount: localData.cards.length,
        studyRecordsCount: localData.studyRecords.length,
        favoritesCount: localData.favorites.length,
        backupData: localData
      })
      setLocalStorageData(BACKUP_STORAGE_KEY, backups.slice(-30))

      wx.hideLoading()

      return { success: true, message: '备份成功', backupId }

    } catch (error) {
      wx.hideLoading()
      console.error('[Sync] 备份失败', error)
      return { success: false, message: '备份失败：' + (error instanceof Error ? error.message : '未知错误') }
    }
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
      } catch (err) {
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
   * 从备份节点快速恢复数据
   * 流程：云端下载备份 → 导入本地 → 同步到云端数据表
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

      // 1. 从云端获取备份数据
      try {
        const { result } = await wx.cloud.callFunction({
          name: 'backup_manager',
          data: { action: 'get', backupId }
        })
        const getResult = result as { success: boolean; data?: any; error?: string }
        if (getResult.success && getResult.data) {
          backupData = getResult.data.backupData as BackupData
        }
      } catch (err) {
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
        }
      }

      if (!backupData) {
        wx.hideLoading()
        return { success: false, message: '备份不存在' }
      }

      // 3. 导入到本地
      importLocalData(backupData)

      // 4. 同步到云端数据表
      try {
        const count = await uploadAllLocalToCloud(userId)
        console.log(`[Sync] 恢复后同步 ${count} 条数据到云端`)
      } catch (err) {
        console.warn('[Sync] 恢复后同步云端失败', err)
      }

      wx.hideLoading()

      return { success: true, message: '恢复成功，数据已同步至云端' }

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
      } catch (err) {
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
}

export const syncManager = new SyncManager()
