const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { recordId, groupId, studyDuration } = event

  try {
    await db.collection('studyRecords').add({
      data: {
        recordId,
        groupId,
        studyDuration,
        studyDate: new Date()
      }
    })
    return { success: true }
  } catch (err) {
    console.error(err)
    return { success: false, error: err }
  }
}
