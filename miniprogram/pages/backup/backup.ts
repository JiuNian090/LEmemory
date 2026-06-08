import { syncManager } from '../../utils/sync'
import type { BackupRecord } from '../../utils/types'

const STATUS_LABELS: Record<string, string> = {
  synced: '已同步',
  local_newer: '本地最新',
  cloud_newer: '云端最新',
  unbacked: '未备份',
  not_logged_in: '未备份 / 未登录',
  checking: '检查中...',
  error: '检查失败'
}

const CACHE_TTL = 300000 // 5 分钟

interface BackupPageData {
  backups: BackupRecord[]
  backupStatus: {
    type: string
    label: string
  }
  storageInfo: {
    used: number
    usedPercent: number
  }
  loading: boolean
  showDescriptionModal: boolean
  currentDescription: string
  showRestoreConfirm: boolean
  selectedBackup: BackupRecord | null
  lastCloudCheckTime: number
  cachedCloudStatus: any
  lastSyncHash: string
  lastSyncTime: number
  lastLocalUpdate: number
}

Page<BackupPageData, WechatMiniprogram.IAnyObject>({
  data: {
    backups: [],
    backupStatus: {
      type: 'checking',
      label: STATUS_LABELS.checking
    },
    storageInfo: {
      used: 0,
      usedPercent: 0
    },
    loading: true,
    showDescriptionModal: false,
    currentDescription: '',
    showRestoreConfirm: false,
    selectedBackup: null,
    lastCloudCheckTime: 0,
    cachedCloudStatus: null,
    lastSyncHash: '',
    lastSyncTime: 0,
    lastLocalUpdate: 0
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  stopPropagation() {},

  async loadData() {
    this.setData({ loading: true })

    try {
      // 加载备份列表，并格式化日期
      const rawBackups = await syncManager.getBackupList()
      const backups = rawBackups.map(b => ({
        ...b,
        backupTimeDisplay: syncManager.formatBackupTime(b.backupTime instanceof Date ? b.backupTime.toISOString() : String(b.backupTime))
      }))

      // 加载云端存储用量
      const cloudStorage = await syncManager.getCloudStorageInfo()
      const CLOUD_TOTAL = 500 * 1024 * 1024 // 500 MB
      const cloudUsed = cloudStorage.success ? cloudStorage.totalSize : 0
      const usedPercent = Math.min(100, Math.round((cloudUsed / CLOUD_TOTAL) * 100))

      // 加载缓存状态
      const lastCloudCheckTime = wx.getStorageSync('lastCloudCheckTime') || 0
      const cachedCloudStatus = wx.getStorageSync('cachedCloudStatus') || null
      const lastSyncHash = wx.getStorageSync('lastSyncHash') || ''
      const lastSyncTime = wx.getStorageSync('lastSyncTime') || 0
      const lastLocalUpdate = wx.getStorageSync('lastLocalUpdate') || Date.now()

      this.setData({
        backups,
        storageInfo: { used: cloudUsed, usedPercent },
        lastCloudCheckTime,
        cachedCloudStatus,
        lastSyncHash,
        lastSyncTime,
        lastLocalUpdate
      })

      // 检查备份状态
      await this.checkBackupStatus(false)
    } catch (error) {
      console.error('[BackupPage] 加载失败', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 检查备份状态（核心逻辑）
   */
  async checkBackupStatus(forceRefresh: boolean) {
    // 短路：缓存未过期且本地无变化 → 直接用缓存
    if (!forceRefresh && this.tryLocalHashShortCircuit()) {
      this.useCachedStatus()
      return
    }

    if (forceRefresh) {
      this.setData({ backupStatus: { type: 'checking', label: STATUS_LABELS.checking } })
    }

    // 需要刷新 → 从云端获取
    if (!this.shouldRefreshCache() && !forceRefresh) {
      this.useCachedStatus()
      return
    }

    try {
      const info = await syncManager.getLatestBackupInfo()
      if (info.success) {
        this.handleFetchSuccess(info)
      } else {
        if (this.data.cachedCloudStatus) {
          this.useCachedStatus()
        } else {
          this.setData({ backupStatus: { type: 'unbacked', label: STATUS_LABELS.unbacked } })
        }
      }
    } catch (err) {
      console.error('[BackupPage] 检查备份状态失败', err)
      if (this.data.cachedCloudStatus) {
        this.useCachedStatus()
      } else {
        this.setData({ backupStatus: { type: 'error', label: STATUS_LABELS.error } })
      }
    }
  },

  /**
   * 本地哈希短路径
   */
  tryLocalHashShortCircuit(): boolean {
    const localHash = syncManager.computeLocalHash()
    const { lastSyncHash, cachedCloudStatus, lastCloudCheckTime } = this.data
    if (lastSyncHash && localHash === lastSyncHash) {
      if (cachedCloudStatus && (Date.now() - lastCloudCheckTime < CACHE_TTL)) {
        return true
      }
      return false
    }
    return false
  },

  /**
   * 判断是否需刷新缓存
   */
  shouldRefreshCache(): boolean {
    const { lastCloudCheckTime, lastSyncHash } = this.data
    const localHash = syncManager.computeLocalHash()
    if (lastSyncHash && localHash !== lastSyncHash) return true
    if (Date.now() - lastCloudCheckTime > CACHE_TTL) return true
    return false
  },

  /**
   * 使用缓存状态
   */
  useCachedStatus(fallback?: { type: string; label: string }) {
    const { cachedCloudStatus } = this.data
    if (cachedCloudStatus) {
      this.updateStatusUI(cachedCloudStatus)
    } else if (fallback) {
      this.setData({ backupStatus: fallback })
    } else {
      this.setData({ backupStatus: { type: 'unbacked', label: STATUS_LABELS.unbacked } })
    }
  },

  /**
   * 处理云端返回结果
   */
  handleFetchSuccess(info: any) {
    const now = Date.now()
    const cloudHash = (typeof info.backupHash === 'string' && info.backupHash.length > 0)
      ? info.backupHash
      : (this.data.lastSyncHash || null)
    const newCache = {
      status: info.hasBackup ? 'has_backup' : 'no_backup',
      time: info.backupTime || null,
      hash: cloudHash
    }

    this.setData({ lastCloudCheckTime: now, cachedCloudStatus: newCache })
    wx.setStorageSync('lastCloudCheckTime', now)
    wx.setStorageSync('cachedCloudStatus', newCache)

    this.updateStatusUI(newCache)
  },

  /**
   * 根据缓存判断并显示备份状态
   */
  updateStatusUI(cache: any) {
    if (!cache || cache.status === 'no_backup') {
      this.setData({ backupStatus: { type: 'unbacked', label: STATUS_LABELS.unbacked } })
      return
    }

    const localHash = syncManager.computeLocalHash()
    const cloudHash = cache.hash || ''
    const cloudBackupTime = cache.time ? new Date(cache.time).getTime() : 0
    const { lastSyncHash, lastSyncTime, lastLocalUpdate } = this.data

    // 已同步：本地哈希与上次同步哈希一致
    if (lastSyncHash && localHash === lastSyncHash) {
      const syncTime = lastSyncTime || cloudBackupTime || lastLocalUpdate
      const syncTimeStr = syncTime ? syncManager.formatBackupTime(new Date(syncTime).toISOString()) : ''
      this.setData({ backupStatus: { type: 'synced', label: '已同步' + (syncTimeStr ? ' ' + syncTimeStr : '') } })
      return
    }

    // 已同步：本地哈希与云端哈希一致
    if (cloudHash && localHash === cloudHash) {
      const syncTime = lastSyncTime || cloudBackupTime || lastLocalUpdate
      const syncTimeStr = syncTime ? syncManager.formatBackupTime(new Date(syncTime).toISOString()) : ''
      this.setData({ backupStatus: { type: 'synced', label: '已同步' + (syncTimeStr ? ' ' + syncTimeStr : '') } })
      return
    }

    const localTimeStr = lastLocalUpdate ? syncManager.formatBackupTime(new Date(lastLocalUpdate).toISOString()) : ''
    const cloudTimeStr = cache.time ? syncManager.formatBackupTime(cache.time) : ''

    if (!cache.time || (cloudBackupTime && lastLocalUpdate > cloudBackupTime)) {
      this.setData({ backupStatus: { type: 'local_newer', label: '本地最新' + (localTimeStr ? ' ' + localTimeStr : '') } })
    } else {
      this.setData({ backupStatus: { type: 'cloud_newer', label: '云端最新' + (cloudTimeStr ? ' ' + cloudTimeStr : '') } })
    }
  },

  /**
   * 点击状态标签手动刷新
   */
  onStatusTap() {
    this.checkBackupStatus(true)
  },

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  },

  onCreateBackup() {
    this.setData({ showDescriptionModal: true, currentDescription: '' })
  },

  onDescriptionInput(e: WechatMiniprogram.Input) {
    this.setData({ currentDescription: e.detail.value })
  },

  async confirmCreateBackup() {
    this.setData({ showDescriptionModal: false })

    const result = await syncManager.createBackup(this.data.currentDescription)

    if (result.success) {
      wx.showToast({ title: result.message, icon: 'success' })
      // 备份后更新本地同步状态
      const localHash = syncManager.computeLocalHash()
      const now = Date.now()
      wx.setStorageSync('lastSyncHash', localHash)
      wx.setStorageSync('lastSyncTime', now)
      wx.setStorageSync('lastBackupHash', localHash)
      wx.setStorageSync('lastBackupTime', new Date().toISOString())
      this.setData({
        lastSyncHash: localHash,
        lastSyncTime: now,
        lastLocalUpdate: now,
        backupStatus: {
          type: 'synced',
          label: '已同步 ' + syncManager.formatBackupTime(new Date().toISOString())
        }
      })
      this.loadData()
    } else {
      wx.showToast({ title: result.message, icon: 'none' })
    }
  },

  cancelCreateBackup() {
    this.setData({ showDescriptionModal: false })
  },

  onRestoreBackup(e: WechatMiniprogram.TouchEvent) {
    const { backup } = e.currentTarget.dataset
    this.setData({ showRestoreConfirm: true, selectedBackup: backup })
  },

  /**
   * 恢复最新备份
   */
  onRestoreLatest() {
    const backups = this.data.backups
    if (backups.length === 0) {
      wx.showToast({ title: '暂无备份', icon: 'none' })
      return
    }
    this.setData({ showRestoreConfirm: true, selectedBackup: backups[0] })
  },

  async confirmRestoreBackup() {
    const backup = this.data.selectedBackup
    if (!backup) return

    this.setData({ showRestoreConfirm: false })

    const result = await syncManager.restoreFromBackup(backup.backupId)

    if (result.success) {
      wx.showToast({ title: result.message, icon: 'success' })
      setTimeout(() => { this.loadData() }, 1500)
    } else {
      wx.showToast({ title: result.message, icon: 'none' })
    }
  },

  cancelRestoreBackup() {
    this.setData({ showRestoreConfirm: false, selectedBackup: null })
  },

  async deleteBackup(e: WechatMiniprogram.TouchEvent) {
    const { backup } = e.currentTarget.dataset

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个备份吗？删除后无法恢复。',
      success: async (res) => {
        if (res.confirm) {
          const success = await syncManager.deleteBackup(backup.backupId)
          if (success) {
            wx.showToast({ title: '删除成功', icon: 'success' })
            this.loadData()
          } else {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }
})
