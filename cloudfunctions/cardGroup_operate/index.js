const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, groupId, title, description } = event

  try {
    if (action === 'create') {
      await db.collection('cardGroups').add({
        data: {
          groupId,
          title,
          description: description || '',
          createTime: new Date(),
          updateTime: new Date()
        }
      })
    } else if (action === 'list') {
      const { data } = await db.collection('cardGroups').where({
        _openid: wxContext.OPENID
      }).orderBy('updateTime', 'desc').get()
      return { data }
    } else if (action === 'update') {
      await db.collection('cardGroups').where({
        groupId
      }).update({
        data: {
          title,
          description,
          updateTime: new Date()
        }
      })
    } else if (action === 'delete') {
      await db.collection('cardGroups').where({ groupId }).remove()
      await db.collection('cards').where({ groupId }).remove()
    }

    return { success: true }
  } catch (err) {
    console.error(err)
    return { success: false, error: err }
  }
}
