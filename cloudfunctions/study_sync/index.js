const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * study_sync 云函数
 * 学习记录的云端同步（跨设备统一使用 username 作为用户标识）
 *
 * 数据模型：study_daily 集合
 *   { username, date: "2026-06-09", groupId, totalDuration, updateTime }
 *   每个 (username, date, groupId) 唯一，通过 _.inc() 原子累加
 */
exports.main = async (event, context) => {
  const { action, username, groupId, duration, date, startDate, endDate } = event

  if (!username) {
    return { success: false, error: '缺少用户标识' }
  }

  try {
    // === 原子累加每日学习时长（退出学习时调用） ===
    if (action === 'syncDaily') {
      const existing = await db.collection('study_daily')
        .where({ username, date, groupId }).get()

      if (existing.data.length > 0) {
        await db.collection('study_daily').doc(existing.data[0]._id).update({
          data: {
            totalDuration: _.inc(duration || 0),
            updateTime: new Date()
          }
        })
      } else {
        await db.collection('study_daily').add({
          data: {
            username,
            date,
            groupId: groupId || '',
            totalDuration: duration || 0,
            updateTime: new Date()
          }
        })
      }
      return { success: true }
    }

    // === 获取今日学习总时长 ===
    if (action === 'getTodayTotal') {
      const today = new Date().toISOString().split('T')[0]
      const query = { username, date: today }
      if (groupId) query.groupId = groupId

      const { data } = await db.collection('study_daily')
        .where(query)
        .get()
      const total = data.reduce((sum, r) => sum + (r.totalDuration || 0), 0)
      return { success: true, total }
    }

    // === 获取日期范围内的每日学习数据（用于统计页） ===
    if (action === 'getDailyData') {
      const query = { username }
      if (startDate || endDate) {
        const dateFilter = {}
        if (startDate) dateFilter.$gte = startDate
        if (endDate) dateFilter.$lte = endDate
        query.date = _.and(dateFilter)
      }

      // 最多 365 条/年/用户，无需分页
      const { data } = await db.collection('study_daily')
        .where(query)
        .orderBy('date', 'desc')
        .get()

      return { success: true, data }
    }

    // === （保留）旧版保存个体记录 - 仅用于旧数据兼容 ===
    if (action === 'save') {
      const result = await db.collection('study_records').add({
        data: {
          username,
          groupId: groupId || '',
          studyDuration: duration || 0,
          studyDate: date ? new Date(date) : new Date(),
          createTime: new Date()
        }
      })
      return { success: true, _id: result._id }
    }

    // === （保留）旧版获取记录 - 仅用于旧数据兼容 ===
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

      const MAX_LIMIT = 100
      const countResult = await db.collection('study_records').where(query).count()
      const totalCount = countResult.total
      const batchTimes = Math.ceil(totalCount / MAX_LIMIT)
      let allData = []
      for (let i = 0; i < batchTimes; i++) {
        const { data } = await db.collection('study_records')
          .where(query)
          .orderBy('studyDate', 'desc')
          .skip(i * MAX_LIMIT)
          .limit(MAX_LIMIT)
          .get()
        allData = allData.concat(data)
      }
      return { success: true, data: allData }
    }

    return { success: false, error: '未知操作' }
  } catch (err) {
    console.error('[StudySync] 操作失败', err)
    return { success: false, error: err.message }
  }
}