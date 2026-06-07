export interface ErrorInfo {
  code: string
  message: string
  detail?: string
}

const ERROR_MESSAGES: Record<string, string> = {
  'auth/network-error': '网络连接异常，请检查网络后重试',
  'auth/login-failed': '登录失败，请稍后重试',
  'db/network-error': '数据库连接失败，请检查网络',
  'db/permission-denied': '访问权限不足',
  'db/document-not-found': '数据不存在',
  'storage/quota-exceeded': '存储空间不足，请清理缓存',
  'storage/write-failed': '保存失败，请重试',
  'sync/conflict': '数据同步冲突，请手动处理',
  'sync/timeout': '同步超时，请稍后重试',
  'cloud/init-failed': '云服务初始化失败，将使用本地存储',
  'cloud/function-error': '云函数调用失败',
  'param/invalid': '参数错误',
  'param/missing': '缺少必要参数',
  'card/empty-content': '卡牌内容不能为空',
  'group/empty-title': '卡牌组标题不能为空',
  'system/unknown': '系统错误，请稍后重试'
}

export function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES['system/unknown']
}

export function showErrorToast(error: Error | string | ErrorInfo): void {
  let message = ''
  
  if (typeof error === 'string') {
    message = getErrorMessage(error)
  } else if (error instanceof Error) {
    message = error.message || '系统错误'
  } else if (error.code) {
    message = getErrorMessage(error.code)
    if (error.detail) {
      message += ` (${error.detail})`
    }
  } else {
    message = '系统错误'
  }
  
  wx.showToast({
    title: message,
    icon: 'none',
    duration: 2000
  })
}

export function showErrorModal(error: Error | string | ErrorInfo): void {
  let title = '出错了'
  let content = ''
  
  if (typeof error === 'string') {
    content = getErrorMessage(error)
  } else if (error instanceof Error) {
    content = error.message || '系统错误'
  } else if (error.code) {
    content = getErrorMessage(error.code)
    if (error.detail) {
      content += `\n详情: ${error.detail}`
    }
  } else {
    content = '系统错误'
  }
  
  wx.showModal({
    title,
    content,
    showCancel: false,
    confirmText: '知道了'
  })
}

export class AppError extends Error {
  code: string
  detail?: string
  
  constructor(code: string, message?: string, detail?: string) {
    super(message || getErrorMessage(code))
    this.code = code
    this.detail = detail
    this.name = 'AppError'
  }
}

export function wrapAsync<T>(fn: () => Promise<T>): Promise<T | null> {
  return fn().catch((error: any) => {
    console.error('[Error] Async operation failed:', error)
    showErrorToast(error)
    return null
  })
}

export function validateParams(params: Record<string, any>, required: string[]): ErrorInfo | null {
  const missing = required.filter(key => !params[key])
  if (missing.length > 0) {
    return {
      code: 'param/missing',
      message: `缺少必要参数: ${missing.join(', ')}`,
      detail: missing.join(', ')
    }
  }
  return null
}

export function reportError(error: any, context?: string): void {
  console.error(`[Error Report] ${context || 'Unknown context'}:`, error)
  
  try {
    const errorData = {
      timestamp: new Date().toISOString(),
      context: context || 'unknown',
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack,
        detail: error.detail
      }
    }
    
    console.log('[Error Report] Sending:', JSON.stringify(errorData))
  } catch (e) {
    console.error('[Error Report] Failed to send:', e)
  }
}