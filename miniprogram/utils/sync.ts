import {
  getUserId,
  generateId,
  exportAllLocalData,
  importLocalData,
  updateSyncStatus,
  getSyncStatus,
  userCollection,
  cardGroupCollection,
  cardCollection,
  studyRecordCollection,
  favoriteCollection,
  backupCollection,
  getStorageInfo,
  clearAllLocalData
} from './db'
import type { BackupData, BackupRecord, CardGroup, Card, StudyRecord, Favorite } from './types'

/**
 * 同步管理器
 */
class SyncManager {
  private isSyncing = false
  private syncQueue: any[] = []

  /**
   * 登录后执行账号关联和数据同步
   */
  async linkAccountAndSync(userInfo: { nickName?: string; avatarUrl?: string } = {}): Promise<{
    success: boolean
    message: string
    syncedCount: number
  }> {
    console.log('[Sync] 开始账号关联和数据同步')
    
    try {
      // 检查云开发是否可用
      const userId = await getUserId()
      if (userId === 'local_user') {
        return {
          success: false,
          message: '云开发不可用，请检查网络连接',
          syncedCount: 0
        }
      }

      updateSyncStatus({ isSyncing: true })
      this.isSyncing = true

      // 1. 检查云端是否已有数据
      const hasCloudData = await this.checkCloudData(userId)
      
      // 2. 获取本地数据
      const localData = exportAllLocalData()
      const hasLocalData = this.hasData(localData)

      let syncedCount = 0

      if (!hasCloudData && hasLocalData) {
        // 云端无数据，本地有数据：上传本地数据到云端
        console.log('[Sync] 云端无数据，上传本地数据')
        syncedCount = await this.uploadLocalDataToCloud(localData, userId, userInfo)
      } else if (hasCloudData && !hasLocalData) {
        // 云端有数据，本地无数据：下载云端数据到本地
        console.log('[Sync] 本地无数据，下载云端数据')
        syncedCount = await this.downloadCloudDataToLocal(userId)
      } else if (hasCloudData && hasLocalData) {
        // 两端都有数据：合并策略（以本地为主，避免覆盖）
        console.log('[Sync] 两端都有数据，执行智能合并')
        syncedCount = await this.mergeAndSyncData(localData, userId, userInfo)
      } else {
        // 两端都无数据
        console.log('[Sync] 两端都无数据')
      }

      // 更新用户信息
      await this.updateUserInfo(userId, userInfo)

      // 更新同步状态
      updateSyncStatus({
        isSyncing: false,
        lastSyncTime: new Date(),
        pendingItems: 0,
        lastError: undefined
      })

      return {
        success: true,
        message: syncedCount > 0 ? `同步完成，共处理 ${syncedCount} 条数据` : '数据已是最新',
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
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * 检查云端是否有数据
   */
  private async checkCloudData(userId: string): Promise<boolean> {
    try {
      const { data } = await cardGroupCollection.where({ userId }).limit(1).get()
      return data.length > 0
    } catch {
      return false
    }
  }

  /**
   * 检查是否有数据
   */
  private hasData(data: BackupData): boolean {
    return data.cardGroups.length > 0 ||
           data.cards.length > 0 ||
           data.studyRecords.length > 0 ||
           data.favorites.length > 0
  }

  /**
   * 上传本地数据到云端
   */
  private async uploadLocalDataToCloud(
    localData: BackupData,
    userId: string,
    userInfo: any
  ): Promise<number> {
    let count = 0

    // 上传卡牌组
    for (const group of localData.cardGroups) {
      await cardGroupCollection.add({
        data: {
          ...group,
          userId,
          _openid: userId,
          syncStatus: 'synced'
        }
      })
      count++
    }

    // 上传卡牌
    for (const card of localData.cards) {
      await cardCollection.add({
        data: {
          ...card,
          userId,
          _openid: userId,
          syncStatus: 'synced'
        }
      })
      count++
    }

    // 上传学习记录
    for (const record of localData.studyRecords) {
      await studyRecordCollection.add({
        data: {
          ...record,
          userId,
          _openid: userId,
          syncStatus: 'synced'
        }
      })
      count++
    }

    // 上传收藏
    for (const favorite of localData.favorites) {
      await favoriteCollection.add({
        data: {
          ...favorite,
          userId,
          _openid: userId,
          syncStatus: 'synced'
        }
      })
      count++
    }

    return count
  }

  /**
   * 下载云端数据到本地
   */
  private async downloadCloudDataToLocal(userId: string): Promise<number> {
    // 从云端获取所有数据
    const [
      { data: cardGroups },
      { data: cards },
      { data: studyRecords },
      { data: favorites }
    ] = await Promise.all([
      cardGroupCollection.where({ userId }).get(),
      cardCollection.where({ userId }).get(),
      studyRecordCollection.where({ userId }).get(),
      favoriteCollection.where({ userId }).get()
    ])

    // 导入到本地
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
  }

  /**
   * 合并并同步数据
   */
  private async mergeAndSyncData(
    localData: BackupData,
    userId: string,
    userInfo: any
  ): Promise<number> {
    // 简单策略：只上传本地新增的（以 groupId/cardId 为标识）
    // 获取云端现有ID
    const { data: cloudGroups } = await cardGroupCollection.where({ userId }).get()
    const cloudGroupIds = new Set(cloudGroups.map((g: any) => g.groupId))

    let count = 0

    // 上传本地新增的卡牌组
    for (const group of localData.cardGroups) {
      if (!cloudGroupIds.has(group.groupId)) {
        await cardGroupCollection.add({
          data: {
            ...group,
            userId,
            _openid: userId,
            syncStatus: 'synced'
          }
        })
        count++
      }
    }

    // 上传卡牌（关联到已存在或新上传的组）
    const { data: cloudCards } = await cardCollection.where({ userId }).get()
    const cloudCardIds = new Set(cloudCards.map((c: any) => c.cardId))

    for (const card of localData.cards) {
      if (!cloudCardIds.has(card.cardId)) {
        await cardCollection.add({
          data: {
            ...card,
            userId,
            _openid: userId,
            syncStatus: 'synced'
          }
        })
        count++
      }
    }

    return count
  }

  /**
   * 更新用户信息
   */
  private async updateUserInfo(userId: string, userInfo: any): Promise<void> {
    try {
      const { data: users } = await userCollection.where({ _openid: userId }).limit(1).get()
      
      if (users.length > 0) {
        // 更新现有用户
        await userCollection.doc(users[0]._id).update({
          data: {
            ...userInfo,
            lastSyncTime: new Date()
          }
        })
      } else {
        // 创建新用户
        await userCollection.add({
          data: {
            _openid: userId,
            ...userInfo,
            createTime: new Date(),
            lastSyncTime: new Date()
          }
        })
      }
    } catch (error) {
      console.error('[Sync] 更新用户信息失败', error)
    }
  }

  /**
   * 手动备份数据到云端
   */
  async createBackup(description?: string): Promise<{
    success: boolean
    message: string
    backupId?: string
  }> {
    try {
      const userId = await getUserId()
      if (userId === 'local_user') {
        return {
          success: false,
          message: '需要先登录才能备份到云端'
        }
      }

      wx.showLoading({ title: '备份中...' })

      // 导出本地数据
      const localData = exportAllLocalData()
      
      // 计算数据大小
      const dataJson = JSON.stringify(localData)
      const dataSize = new Blob([dataJson]).size

      // 创建备份记录
      const backupId = generateId()
      const backupRecord: BackupRecord = {
        backupId,
        userId,
        backupTime: new Date(),
        dataSize,
        description,
        cardGroupsCount: localData.cardGroups.length,
        cardsCount: localData.cards.length,
        studyRecordsCount: localData.studyRecords.length,
        favoritesCount: localData.favorites.length
      }

      // 保存备份记录和数据
      await backupCollection.add({
        data: {
          ...backupRecord,
          backupData: localData,
          _openid: userId
        }
      })

      wx.hideLoading()

      return {
        success: true,
        message: '备份成功',
        backupId
      }

    } catch (error) {
      wx.hideLoading()
      console.error('[Sync] 备份失败', error)
      return {
        success: false,
        message: '备份失败：' + (error instanceof Error ? error.message : '未知错误')
      }
    }
  }

  /**
   * 获取备份列表
   */
  async getBackupList(): Promise<BackupRecord[]> {
    try {
      const userId = await getUserId()
      if (userId === 'local_user') {
        return []
      }

      const { data } = await backupCollection
        .where({ userId })
        .orderBy('backupTime', 'desc')
        .limit(20)
        .get()

      return data.map((item: any) => ({
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
   * 从备份恢复数据
   */
  async restoreFromBackup(backupId: string): Promise<{
    success: boolean
    message: string
  }> {
    try {
      const userId = await getUserId()
      if (userId === 'local_user') {
        return {
          success: false,
          message: '需要先登录才能恢复备份'
        }
      }

      wx.showLoading({ title: '恢复中...' })

      // 获取备份数据
      const { data: backups } = await backupCollection
        .where({ backupId, userId })
        .limit(1)
        .get()

      if (backups.length === 0) {
        wx.hideLoading()
        return {
          success: false,
          message: '备份不存在'
        }
      }

      const backupData = backups[0].backupData as BackupData
      
      // 导入到本地
      importLocalData(backupData)

      wx.hideLoading()

      return {
        success: true,
        message: '恢复成功'
      }

    } catch (error) {
      wx.hideLoading()
      console.error('[Sync] 恢复失败', error)
      return {
        success: false,
        message: '恢复失败：' + (error instanceof Error ? error.message : '未知错误')
      }
    }
  }

  /**
   * 删除备份
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const userId = await getUserId()
      if (userId === 'local_user') {
        return false
      }

      const { data: backups } = await backupCollection
        .where({ backupId, userId })
        .limit(1)
        .get()

      if (backups.length > 0) {
        await backupCollection.doc(backups[0]._id).remove()
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

// 导出单例
export const syncManager = new SyncManager()
