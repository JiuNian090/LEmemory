const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const crypto = require('crypto')

function calculateHash(data) {
  if (typeof data === 'string') {
    return crypto.createHash('sha256').update(data).digest('hex')
  }
  return ''
}

exports.main = async (event, context) => {
  const { action, backupId, description, backupData, dataSize, cardGroupsCount, cardsCount, studyRecordsCount, favoritesCount } = event
  const wxContext = cloud.getWXContext()
  const userId = wxContext.OPENID

  try {
    if (action === 'getBackupInfo') {
      // 获取最新备份的信息（用于状态对比）
      const { data } = await db.collection('backups')
        .where({ userId })
        .orderBy('backupTime', 'desc')
        .limit(1)
        .get()

      if (data.length === 0) {
        return { success: true, hasBackup: false }
      }

      const latest = data[0]
      const rawData = latest.backupData || {}

      // 对数据内容哈希（与前端 computeLocalHash 一致）
      const cardGroups = rawData.cardGroups || []
      const cards = rawData.cards || []
      const studyRecords = rawData.studyRecords || []
      const favorites = rawData.favorites || []
      const studyDaily = rawData.studyDaily || {}
      const combined = JSON.stringify(cardGroups) + JSON.stringify(cards)
        + JSON.stringify(studyRecords) + JSON.stringify(favorites)
        + JSON.stringify(studyDaily)
      const backupHash = calculateHash(combined)

      return {
        success: true,
        hasBackup: true,
        data: {
          backupTime: latest.backupTime,
          backupHash,
          cardGroupsCount: latest.cardGroupsCount || 0,
          cardsCount: latest.cardsCount || 0,
          studyRecordsCount: latest.studyRecordsCount || 0,
          favoritesCount: latest.favoritesCount || 0
        }
      }

    } else if (action === 'list') {
      const { data } = await db.collection('backups')
        .where({ userId })
        .orderBy('backupTime', 'desc')
        .limit(50)
        .get()

      return {
        success: true,
        data: data.map(item => ({
          backupId: item.backupId,
          userId: item.userId,
          backupTime: item.backupTime,
          dataSize: item.dataSize,
          description: item.description,
          cardGroupsCount: item.cardGroupsCount,
          cardsCount: item.cardsCount,
          studyRecordsCount: item.studyRecordsCount,
          favoritesCount: item.favoritesCount
        }))
      }

    } else if (action === 'create') {
      // 每个用户只保留一份备份：有则更新，无则新建（原子操作）
      const { data: existing } = await db.collection('backups')
        .where({ userId })
        .orderBy('backupTime', 'asc')
        .limit(1)
        .get()

      // 校验备份数据大小
      const actualDataSize = JSON.stringify(backupData || {}).length
      if (actualDataSize > 1024 * 1024) {
        return { success: false, error: '备份数据过大，请减少卡片数量后重试' }
      }

      if (existing.length > 0) {
        // 更新现有备份（原子操作，避免先删后写数据丢失）
        await db.collection('backups').doc(existing[0]._id).update({
          data: {
            backupData: backupData || {},
            backupTime: new Date(),
            dataSize: actualDataSize,
            description: description || '',
            cardGroupsCount: cardGroupsCount || 0,
            cardsCount: cardsCount || 0,
            studyRecordsCount: studyRecordsCount || 0,
            favoritesCount: favoritesCount || 0
          }
        })
        return { success: true, _id: existing[0]._id, backupId }
      } else {
        // 新建备份
        const result = await db.collection('backups').add({
          data: {
            backupId,
            userId,
            appVersion: event.appVersion || 'unknown',
            backupTime: new Date(),
            dataSize: actualDataSize,
            description: description || '',
            cardGroupsCount: cardGroupsCount || 0,
            cardsCount: cardsCount || 0,
            studyRecordsCount: studyRecordsCount || 0,
            favoritesCount: favoritesCount || 0,
            backupData: backupData || {}
          }
        })
        return { success: true, _id: result._id, backupId }
      }

    } else if (action === 'get') {
      const { data } = await db.collection('backups')
        .where({ backupId, userId })
        .limit(1)
        .get()

      if (data.length === 0) {
        return { success: false, error: '备份不存在' }
      }

      return {
        success: true,
        data: {
          backupId: data[0].backupId,
          userId: data[0].userId,
          backupTime: data[0].backupTime,
          dataSize: data[0].dataSize,
          description: data[0].description,
          cardGroupsCount: data[0].cardGroupsCount,
          cardsCount: data[0].cardsCount,
          studyRecordsCount: data[0].studyRecordsCount,
          favoritesCount: data[0].favoritesCount,
          backupData: data[0].backupData
        }
      }

    } else if (action === 'getCloudStorageInfo') {
      // 获取云端存储用量（计算该用户所有备份文档的实际大小）
      const { data } = await db.collection('backups')
        .where({ userId })
        .get()

      let totalSize = 0
      data.forEach(item => {
        // 计算完整文档的 JSON 字符串长度作为实际占用大小
        const docStr = JSON.stringify(item)
        totalSize += Buffer.byteLength(docStr, 'utf8')
      })

      return {
        success: true,
        data: { totalSize, backupCount: data.length }
      }

    } else if (action === 'delete') {
      const { data } = await db.collection('backups')
        .where({ backupId, userId })
        .limit(1)
        .get()

      if (data.length > 0) {
        await db.collection('backups').doc(data[0]._id).remove()
      }

      return { success: true }

    } else if (action === 'getUserId') {
      // 无副作用地获取当前用户的 OPENID
      return { success: true, userId: wxContext.OPENID }
    }

    return { success: false, error: '未知操作' }
  } catch (error) {
    console.error('[BackupManager] 操作失败', error)
    return { success: false, error: error.message }
  }
}
