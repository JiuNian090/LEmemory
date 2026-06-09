const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async () => {
  try {
    const result = await cloud.openapi.urllink.generate({
      path: '/pages/study/study',
      query: '',
      expireTime: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
    })
    return {
      success: true,
      urlLink: result.openlink
    }
  } catch (err) {
    console.error('[ShareLink] 生成失败', err.message)
    // 开发版/体验版可能不支持生成 URL Link，提供备用方案
    return {
      success: false,
      error: err.message,
      fallback: true
    }
  }
}
