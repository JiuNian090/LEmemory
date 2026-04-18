const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action, cardId, groupId, front, back } = event

  try {
    if (action === 'create') {
      await db.collection('cards').add({
        data: {
          cardId,
          groupId,
          front,
          back,
          createTime: new Date()
        }
      })
    } else if (action === 'list') {
      const { data } = await db.collection('cards').where({
        groupId
      }).get()
      return { data }
    } else if (action === 'update') {
      await db.collection('cards').where({
        cardId
      }).update({
        data: { front, back }
      })
    } else if (action === 'delete') {
      await db.collection('cards').where({ cardId }).remove()
    }

    return { success: true }
  } catch (err) {
    console.error(err)
    return { success: false, error: err }
  }
}
