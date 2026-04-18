const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { nickName, avatarUrl } = event

  try {
    const { data } = await db.collection('users').where({
      _openid: wxContext.OPENID
    }).get()

    if (data.length === 0) {
      await db.collection('users').add({
        data: {
          nickName,
          avatarUrl,
          createTime: new Date()
        }
      })
    } else {
      await db.collection('users').doc(data[0]._id).update({
        data: {
          nickName,
          avatarUrl
        }
      })
    }

    return {
      success: true
    }
  } catch (err) {
    console.error(err)
    return {
      success: false,
      error: err
    }
  }
}
