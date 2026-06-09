/**
 * 简单的加密工具
 * 注意：此加密仅提供基础的混淆保护，不适用于高安全场景
 * 微信 wx.setStorageSync 本身已提供沙箱隔离存储
 */

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='

function base64Encode(str: string): string {
  try {
    const bytes = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
      (_, p1) => String.fromCharCode(parseInt(p1, 16))
    )
    let result = ''
    let i = 0
    while (i < bytes.length) {
      const a = bytes.charCodeAt(i++)
      const b = bytes.charCodeAt(i++)
      const c = bytes.charCodeAt(i++)
      const idx1 = a >> 2
      const idx2 = ((a & 3) << 4) | (b >> 4)
      const idx3 = isNaN(b) ? 64 : ((b & 15) << 2) | (c >> 6)
      const idx4 = isNaN(c) ? 64 : c & 63
      result += BASE64_CHARS.charAt(idx1) + BASE64_CHARS.charAt(idx2)
        + BASE64_CHARS.charAt(idx3) + BASE64_CHARS.charAt(idx4)
    }
    return result
  } catch {
    return str
  }
}

function base64Decode(str: string): string {
  try {
    let bytes = ''
    let i = 0
    while (i < str.length) {
      const idx1 = BASE64_CHARS.indexOf(str.charAt(i++))
      const idx2 = BASE64_CHARS.indexOf(str.charAt(i++))
      const idx3 = BASE64_CHARS.indexOf(str.charAt(i++))
      const idx4 = BASE64_CHARS.indexOf(str.charAt(i++))
      if (idx1 === -1 || idx2 === -1) break
      bytes += String.fromCharCode((idx1 << 2) | (idx2 >> 4))
      if (idx3 !== 64) {
        bytes += String.fromCharCode(((idx2 & 15) << 4) | (idx3 >> 2))
        if (idx4 !== 64) {
          bytes += String.fromCharCode(((idx3 & 3) << 6) | idx4)
        }
      }
    }
    return decodeURIComponent(bytes.split('').map((c: string) =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''))
  } catch {
    return str
  }
}

/**
 * 运行时派生加密密钥（避免硬编码）
 * 基于设备信息和运行时种子生成，同一设备上保持稳定
 */
function getSecretKey(): string {
  try {
    const seed = wx.getStorageSync('__crypto_seed') || ''
    if (!seed) {
      const sysInfo = wx.getSystemInfoSync()
      const newSeed = `le_${sysInfo.SDKVersion}_${sysInfo.brand || ''}_${sysInfo.model || ''}`
      wx.setStorageSync('__crypto_seed', newSeed)
      return newSeed
    }
    return seed
  } catch {
    // 兜底：使用应用标识
    return 'lememory_default_key'
  }
}

/**
 * 简单的字符串混淆加密
 */
function simpleEncrypt(text: string): string {
  try {
    const key = getSecretKey()
    let result = ''
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      result += String.fromCharCode(charCode)
    }
    // Base64 编码
    return base64Encode(result)
  } catch (error) {
    console.error('[Crypto] 加密失败', error)
    return text
  }
}

/**
 * 简单的字符串解密
 */
function simpleDecrypt(encrypted: string): string {
  try {
    const key = getSecretKey()
    // Base64 解码
    const text = base64Decode(encrypted)
    
    let result = ''
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      result += String.fromCharCode(charCode)
    }
    return result
  } catch (error) {
    console.error('[Crypto] 解密失败', error)
    return encrypted
  }
}

/**
 * 加密数据并存储
 */
export function setEncryptedStorage(key: string, data: any): boolean {
  try {
    const jsonString = JSON.stringify(data)
    const encrypted = simpleEncrypt(jsonString)
    wx.setStorageSync(key, encrypted)
    console.log('[Crypto] 数据加密存储成功', key)
    return true
  } catch (error) {
    console.error('[Crypto] 加密存储失败:', error)
    throw new Error('数据加密存储失败')
  }
}

/**
 * 读取并解密数据
 */
export function getEncryptedStorage(key: string): any {
  try {
    const encrypted = wx.getStorageSync(key)
    if (!encrypted) {
      return null
    }

    // 尝试用当前密钥解密
    try {
      const decrypted = simpleDecrypt(encrypted)
      return JSON.parse(decrypted)
    } catch {
      // 当前密钥解密失败 → 尝试用旧硬编码密钥兼容（数据迁移）
      try {
        const oldKey = 'lememory_2024_secure_key'
        const text = base64Decode(encrypted)
        let result = ''
        for (let i = 0; i < text.length; i++) {
          const charCode = text.charCodeAt(i) ^ oldKey.charCodeAt(i % oldKey.length)
          result += String.fromCharCode(charCode)
        }
        const parsed = JSON.parse(result)

        // 迁移成功 → 用新密钥重新加密保存
        try {
          setEncryptedStorage(key, parsed)
        } catch { /* 静默处理 */ }

        return parsed
      } catch {
        // 完全未知格式，安全降级
        console.warn('[Crypto] 无法解析存储数据，key:', key)
        return null
      }
    }
  } catch (error) {
    console.error('[Crypto] 读取解密数据失败', error)
    return null
  }
}

/**
 * 生成数据哈希（用于校验数据完整性）
 */
export function generateDataHash(data: any): string {
  const jsonString = JSON.stringify(data)
  // FNV-1a 64-bit（比 DJB2 32-bit 更抗碰撞）
  const FNV_OFFSET = 0xcbf29ce484222325n
  const FNV_PRIME = 0x100000001b3n
  let hash = FNV_OFFSET
  for (let i = 0; i < jsonString.length; i++) {
    hash ^= BigInt(jsonString.charCodeAt(i))
    hash = (hash * FNV_PRIME) & 0xffffffffffffffffn
  }
  return hash.toString(36)
}
