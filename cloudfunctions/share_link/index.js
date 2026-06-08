const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async () => {
  try {
    const result = await cloud.openapi.urllink.generate({
      path: '/pages/shareImport/shareImport',
      query: '',
      expireTime: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
    })
    return {
      success: true,
      urlLink: result.openlink
    }
  } catch (err) {
    return {
      success: false,
      error: err.message
    }
  }
}