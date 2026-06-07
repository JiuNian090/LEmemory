import { updateSyncStatus } from './db'
import type { SyncChange, SyncResult } from './types'

const SYNC_DEBOUNCE_MS = 2500
const SYNC_RETRY_MAX = 3

class SyncEngine {
  private queue: SyncChange[] = []
  private timer: any = null
  private syncing: boolean = false
  private enabled: boolean = false

  /** 初始化并启动同步引擎 */
  start(): void {
    this.enabled = true
    this.loadPendingQueue()
    if (this.queue.length > 0) {
      this.scheduleSync()
    }
    console.log('[SyncEngine] 已启动，队列长度:', this.queue.length)
  }

  /** 停止同步引擎 */
  stop(): void {
    this.enabled = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    console.log('[SyncEngine] 已停止')
  }

  /** 将变更推入队列 */
  enqueue(change: Omit<SyncChange, 'retryCount'>): void {
    if (!this.enabled) return
    this.queue.push({ ...change, retryCount: 0 })
    updateSyncStatus({ pendingItems: this.queue.length })
    this.scheduleSync()
    console.log(`[SyncEngine] 入队: ${change.type} ${change.collection} ${change.id}`)
  }

  /** 防抖调度同步 */
  private scheduleSync(): void {
    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.timer = setTimeout(() => {
      this.timer = null
      this.executeSync()
    }, SYNC_DEBOUNCE_MS)
  }

  /** 立即执行同步（不等待防抖） */
  async flushNow(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    await this.executeSync()
  }

  /** 执行同步 */
  private async executeSync(): Promise<void> {
    if (this.syncing || this.queue.length === 0) return
    this.syncing = true

    try {
      updateSyncStatus({ isSyncing: true })

      const changes = [...this.queue]
      this.queue = []
      updateSyncStatus({ pendingItems: 0 })

      console.log(`[SyncEngine] 开始同步 ${changes.length} 条变更`)

      const { result } = await wx.cloud.callFunction({
        name: 'backup_manager',
        data: {
          action: 'sync',
          changes: changes.map(c => ({
            type: c.type,
            collection: c.collection,
            item: c.item,
            updateTime: c.updateTime
          }))
        }
      })

      const syncResult = result as SyncResult

      if (syncResult.success) {
        updateSyncStatus({
          isSyncing: false,
          lastSyncTime: new Date(),
          lastError: undefined
        })
        console.log(`[SyncEngine] 同步完成: 处理 ${syncResult.processed}, 跳过 ${syncResult.skipped}`)
      } else {
        this.requeueFailed(changes)
      }
    } catch (err) {
      console.error('[SyncEngine] 同步失败', err)
      this.requeueFailed(this.queue.length > 0 ? this.queue : [])
      updateSyncStatus({
        isSyncing: false,
        lastError: err instanceof Error ? err.message : '同步失败'
      })
    } finally {
      this.syncing = false
    }
  }

  /** 重新入队失败的变更 */
  private requeueFailed(changes: SyncChange[]): void {
    const retryable = changes
      .filter(c => c.retryCount < SYNC_RETRY_MAX)
      .map(c => ({ ...c, retryCount: c.retryCount + 1 }))

    if (retryable.length > 0) {
      this.queue = [...retryable, ...this.queue]
      updateSyncStatus({ pendingItems: this.queue.length })
      this.savePendingQueue()
      console.log(`[SyncEngine] ${retryable.length} 条变更将在下次重试`)
    }

    const dropped = changes.length - retryable.length
    if (dropped > 0) {
      console.warn(`[SyncEngine] ${dropped} 条变更已超过最大重试次数，已丢弃`)
    }
  }

  /** 持久化待同步队列到本地存储 */
  private savePendingQueue(): void {
    try {
      wx.setStorageSync('sync_pending_queue', this.queue)
    } catch (_) {}
  }

  /** 从本地存储恢复待同步队列 */
  private loadPendingQueue(): void {
    try {
      const saved = wx.getStorageSync('sync_pending_queue')
      if (Array.isArray(saved)) {
        this.queue = saved
      }
    } catch (_) {}
  }
}

export const syncEngine = new SyncEngine()