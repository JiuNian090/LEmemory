const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * study_sync 云函数
 * 学习记录的云端同步（跨设备统一使用 username 作为用户标识）
 */
exports.main = async (event, context) => {
  const { action, username, groupId, duration, studyDate, startDate, endDate } = event

  if (!username) {
    return { success: false, error: '缺少用户标识' }
  }

  try {
    // === 保存一条学习记录（增量秒数） ===
    if (action === 'save') {
      const result = await db.collection('study_records').add({
        data: {
          username,
          groupId: groupId || '',
          studyDuration: duration || 0,
          studyDate: studyDate ? new Date(studyDate) : new Date(),
          createTime: new Date()
        }
      })
      return { success: true, _id: result._id }
    }

    // === 获取今日学习总时长（按 groupId 或全部） ===
    if (action === 'getTodayTotal') {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date()
      todayEnd.setHours(23, 59, 59, 999)

      const query = {
        username,
        studyDate: _.gte(todayStart).and(_.lte(todayEnd))
      }
      if (groupId) query.groupId = groupId

      const { data } = await db.collection('study_records').where(query).get()
      const total = data.reduce((sum, r) => sum + (r.studyDuration || 0), 0)
      return { success: true, total }
    }

    // === 获取日期范围内的所有记录（用于统计页） ===
    if (action === 'getRecords') {
      const query = { username }

      if (startDate || endDate) {
        const dateFilter = {}
        if (startDate) dateFilter.$gte = new Date(startDate)
        if (endDate) {
          const end = new Date(endDate)
          end.setHours(23, 59, 59, 999)
          dateFilter.$lte = end
        }
        query.studyDate = _.and(dateFilter)
      }

      const { data } = await db.collection('study_records')
        .where(query)
        .orderBy('studyDate', 'desc')
        .get()

      return { success: true, data }
    }

    return { success: false, error: '未知操作' }
  } catch (err) {
    console.error('[StudySync] 操作失败', err)
    return { success: false, error: err.message }
  }
}