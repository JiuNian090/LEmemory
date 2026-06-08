import { syncManager } from '../../utils/sync'
import { getStorageInfo } from '../../utils/db'
import type { BackupRecord } from '../../utils/types'

interface BackupPageData {
  backups: BackupRecord[]
  backupStatus: {
    hasBackup: boolean
    backupTime: string | null
    isSynced: boolean
    statusLabel: string
    statusType: string
  }
  storageInfo: {
    used: number
    limit: number
    usedPercent: number
  }
  loading: boolean
  showDescriptionModal: boolean
  currentDescription: string
  showRestoreConfirm: boolean
  selectedBackup: BackupRecord | null
}

Page<BackupPageData, WechatMiniprogram.IAnyObject>({
  data: {
    backups: [],
    backupStatus: {
      hasBackup: false,
      backupTime: null,
      isSynced: false,
      statusLabel: '检查中...',
      statusType: 'checking'
    },
    storageInfo: {
      used: 0,
      limit: 10240,
      usedPercent: 0
    },
    loading: true,
    showDescriptionModal: false,
    currentDescription: '',
    showRestoreConfirm: false,
    selectedBackup: null
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

  /**
   * 阻止事件冒泡
   */
  stopPropagation() {},

  /**
   * 加载数据
   */
  async loadData() {
    this.setData({ loading: true })

    try {
      // 加载备份列表
      const backups = await syncManager.getBackupList()

      // 加载备份状态
      const status = syncManager.getBackupStatus()
      let statusLabel: string
      let statusType: string

      if (!status.hasBackup) {
        statusLabel = '未备份'
        statusType = 'unbacked'
      } else if (status.isSynced) {
        statusLabel = '已同步'
        statusType = 'synced'
      } else {
        statusLabel = '本地最新（需备份）'
        statusType = 'local_newer'
      }

      // 加载存储信息
      const storageInfo = getStorageInfo()
      const usedPercent = Math.min(100, Math.round((storageInfo.used / storageInfo.limit) * 100))

      this.setData({
        backups,
        backupStatus: {
          ...status,
          statusLabel,
          statusType
        },
        storageInfo: {
          ...storageInfo,
          usedPercent
        }
      })
    } catch (error) {
      console.error('[BackupPage] 加载失败', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 格式大小
   */
  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  },

  /**
   * 格式化备份时间
   */
  formatBackupTime(isoString: string): string {
    if (!isoString) return ''
    const date = new Date(isoString)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hh = date.getHours().toString().padStart(2, '0')
    const mm = date.getMinutes().toString().padStart(2, '0')
    return month + '-' + day + ' ' + hh + ':' + mm
  },

  /**
   * 点击创建备份
   */
  onCreateBackup() {
    this.setData({
      showDescriptionModal: true,
      currentDescription: ''
    })
  },

  /**
   * 输入备份描述
   */
  onDescriptionInput(e: WechatMiniprogram.Input) {
    this.setData({ currentDescription: e.detail.value })
  },

  /**
   * 确认创建备份
   */
  async confirmCreateBackup() {
    this.setData({ showDescriptionModal: false })

    const result = await syncManager.createBackup(this.data.currentDescription)

    if (result.success) {
      wx.showToast({
        title: result.message,
        icon: 'success'
      })
      this.loadData()
    } else {
      wx.showToast({
        title: result.message,
        icon: 'none'
      })
    }
  },

  /**
   * 取消创建备份
   */
  cancelCreateBackup() {
    this.setData({ showDescriptionModal: false })
  },

  /**
   * 点击恢复备份
   */
  onRestoreBackup(e: WechatMiniprogram.TouchEvent) {
    const { backup } = e.currentTarget.dataset
    this.setData({
      showRestoreConfirm: true,
      selectedBackup: backup
    })
  },

  /**
   * 确认恢复备份
   */
  async confirmRestoreBackup() {
    const backup = this.data.selectedBackup
    if (!backup) return

    this.setData({ showRestoreConfirm: false })

    const result = await syncManager.restoreFromBackup(backup.backupId)

    if (result.success) {
      wx.showToast({
        title: result.message,
        icon: 'success'
      })
      // 延迟刷新，让用户看到提示
      setTimeout(() => {
        this.loadData()
      }, 1500)
    } else {
      wx.showToast({
        title: result.message,
        icon: 'none'
      })
    }
  },

  /**
   * 取消恢复备份
   */
  cancelRestoreBackup() {
    this.setData({
      showRestoreConfirm: false,
      selectedBackup: null
    })
  },

  /**
   * 删除备份
   */
  async deleteBackup(e: WechatMiniprogram.TouchEvent) {
    const { backup } = e.currentTarget.dataset

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个备份吗？删除后无法恢复。',
      success: async (res) => {
        if (res.confirm) {
          const success = await syncManager.deleteBackup(backup.backupId)

          if (success) {
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })
            this.loadData()
          } else {
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          }
        }
      }
    })
  }
})
