const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action, backupId, description } = event
  const wxContext = cloud.getWXContext()
  const userId = wxContext.OPENID

  try {
    if (action === 'list') {
      // 获取备份列表
      const { data } = await db.collection('backups')
        .where({ userId })
        .orderBy('backupTime', 'desc')
        .limit(20)
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
    } else if (action === 'get') {
      // 获取单个备份详情
      const { data } = await db.collection('backups')
        .where({ backupId, userId })
        .limit(1)
        .get()
      
      if (data.length === 0) {
        return { success: false, error: '备份不存在' }
      }
      
      return {
        success: true,
        data: data[0].backupData
      }
    } else if (action === 'delete') {
      // 删除备份
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
