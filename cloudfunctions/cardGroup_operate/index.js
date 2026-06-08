const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 分享卡牌组相关操作（只保留，用于分享导入）
 * create/update/delete 等功能已迁移到纯本地操作
 */
exports.main = async (event, context) => {
  const { action, groupId } = event

  try {
    if (action === 'getSharedGroup') {
      const groupResult = await db.collection('cardGroups').where({
        groupId
      }).get()

      const cardsResult = await db.collection('cards').where({
        groupId
      }).get()

      return {
        success: true,
        data: {
          group: groupResult.data[0] || null,
          cards: cardsResult.data
        }
      }
    }

    return { success: false, error: '未知操作' }
  } catch (err) {
    console.error(err)
    return { success: false, error: err.message }
  }
}
