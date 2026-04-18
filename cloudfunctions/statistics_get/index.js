const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const $ = db.command.aggregate

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  try {
    const { data: allRecords } = await db.collection('studyRecords').where({
      _openid: wxContext.OPENID
    }).get()

    let totalDuration = 0
    const groupMap: any = {}
    const weekMap: any = {}

    allRecords.forEach(record => {
      totalDuration += record.studyDuration

      if (!groupMap[record.groupId]) {
        groupMap[record.groupId] = 0
      }
      groupMap[record.groupId] += record.studyDuration

      const dateStr = record.studyDate.toISOString().split('T')[0]
      if (!weekMap[dateStr]) {
        weekMap[dateStr] = 0
      }
      weekMap[dateStr] += record.studyDuration
    })

    const groupDurations = Object.keys(groupMap).map(groupId => ({
      groupId,
      duration: groupMap[groupId]
    }))

    const weekTrend = Object.keys(weekMap).sort().slice(-7).map(date => ({
      date,
      duration: weekMap[date]
    }))

    return {
      success: true,
      data: {
        totalDuration,
        groupDurations,
        weekTrend
      }
    }
  } catch (err) {
    console.error(err)
    return { success: false, error: err }
  }
}
