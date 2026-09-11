/**
 * 构建小程序 npm 组件，等价于开发者工具「工具 → 构建 npm」。
 *
 * miniprogram_npm 属于构建产物，不纳入版本管理；新环境执行 `npm install` 后
 * 运行 `npm run build:npm` 即可重新生成（无需代码上传密钥）。
 */
const path = require('path')
const ci = require('miniprogram-ci')

const PROJECT_ROOT = path.resolve(__dirname, '..')

async function buildNpm() {
  const result = await ci.packNpmManually({
    packageJsonPath: path.join(PROJECT_ROOT, 'package.json'),
    miniprogramNpmDistDir: path.join(PROJECT_ROOT, 'miniprogram'),
  })

  const { miniProgramPackNum = 0, otherNpmPackNum = 0, warnList = [] } = result || {}
  console.log(`构建 npm 完成：小程序包 ${miniProgramPackNum} 个，其他 npm 包 ${otherNpmPackNum} 个`)

  for (const warn of warnList) {
    console.warn(`构建警告：${warn.msg || JSON.stringify(warn)}`)
  }
}

buildNpm().catch(err => {
  console.error('构建 npm 失败：', err)
  process.exit(1)
})
