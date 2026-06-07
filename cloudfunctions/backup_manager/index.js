const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action, backupId, description, backupData, dataSize, cardGroupsCount, cardsCount, studyRecordsCount, favoritesCount } = event
  const wxContext = cloud.getWXContext()
  const userId = wxContext.OPENID

  try {
    if (action === 'list') {
      const { data } = await db.collection('backups')
        .where({ userId })
        .orderBy('backupTime', 'desc')
        .limit(50)
        .get()

      return {
        success: true,
        data: data.map(item => ({
          backupId: item.backupId,
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
      const result = await db.collection('backups').add({
        data: {
          backupId,
          userId,
          appVersion: event.appVersion || 'unknown',
          backupTime: new Date(),
          dataSize: dataSize || 0,
          description: description || '',
          cardGroupsCount: cardGroupsCount || 0,
          cardsCount: cardsCount || 0,
          studyRecordsCount: studyRecordsCount || 0,
          favoritesCount: favoritesCount || 0,
          backupData: backupData || {}
        }
      })

      return {
        success: true,
        _id: result._id,
        backupId
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
    } else if (action === 'delete') {
      const { data } = await db.collection('backups')
        .where({ backupId, userId })
        .limit(1)
        .get()

      if (data.length > 0) {
        await db.collection('backups').doc(data[0]._id).remove()
      }

      return { success: true }
    }

    return { success: false, error: '未知操作' }
  } catch (error) {
    console.error('[BackupManager] 操作失败', error)
    return { success: false, error: error.message }
  }
}
