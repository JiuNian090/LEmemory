/**
 * 卡牌模板的纯函数部分（不依赖 wx API，可被 node 直接运行验证）
 *
 * 模板决定「问题 / 答案 / 扩展」三类字段的显示名；
 * 模板的持久化直接使用 utils/db 的 cardTemplateCollection（与其它集合一致）。
 */
import type { CardTemplate, TemplateField, TemplateFieldRole } from './types'

/** 内置默认模板 id */
export const DEFAULT_TEMPLATE_ID = 'builtin-default'

/** 三类字段角色的默认显示名（模板缺省时的回落） */
export const ROLE_FALLBACK_NAMES: Record<TemplateFieldRole, string> = {
  question: '问题',
  answer: '答案',
  extra: '扩展'
}

/** 字段显示名长度上限 */
export const MAX_FIELD_NAME_LENGTH = 10

/** 模板名称长度上限 */
export const MAX_TEMPLATE_NAME_LENGTH = 20

/** 解析后的三类字段显示名 */
export interface ResolvedTemplateFields {
  question: string
  answer: string
  extra: string
}

/** 生成内置默认模板（每次返回新对象，避免共享可变状态） */
export function getBuiltinTemplate(): CardTemplate {
  return {
    templateId: DEFAULT_TEMPLATE_ID,
    userId: '',
    name: '基础模板',
    fields: [
      { fieldId: 'builtin-q', role: 'question', name: ROLE_FALLBACK_NAMES.question },
      { fieldId: 'builtin-a', role: 'answer', name: ROLE_FALLBACK_NAMES.answer },
      { fieldId: 'builtin-e', role: 'extra', name: ROLE_FALLBACK_NAMES.extra }
    ],
    createTime: new Date(0),
    updateTime: 0,
    isBuiltin: true
  }
}

/** 生成一套默认字段（新建自定义模板时的起点） */
export function buildDefaultFields(): TemplateField[] {
  return [
    { fieldId: 'field-q', role: 'question', name: ROLE_FALLBACK_NAMES.question },
    { fieldId: 'field-a', role: 'answer', name: ROLE_FALLBACK_NAMES.answer },
    { fieldId: 'field-e', role: 'extra', name: ROLE_FALLBACK_NAMES.extra }
  ]
}

/**
 * 解析模板的三类字段显示名；模板缺失、字段缺失或名称为空时回落默认名。
 */
export function resolveFields(template?: Readonly<CardTemplate> | null): ResolvedTemplateFields {
  const fields = template && Array.isArray(template.fields) ? template.fields : []
  return {
    question: findFieldName(fields, 'question') || ROLE_FALLBACK_NAMES.question,
    answer: findFieldName(fields, 'answer') || ROLE_FALLBACK_NAMES.answer,
    extra: findFieldName(fields, 'extra') || ROLE_FALLBACK_NAMES.extra
  }
}

/**
 * 校验模板结构；通过返回 null，否则返回面向用户的错误文案。
 */
export function validateTemplate(template: Readonly<CardTemplate>): string | null {
  const name = (template.name || '').trim()
  if (!name) return '模板名称不能为空'
  if (name.length > MAX_TEMPLATE_NAME_LENGTH) return `模板名称最多 ${MAX_TEMPLATE_NAME_LENGTH} 个字`

  const fields = Array.isArray(template.fields) ? template.fields : []

  const countOf = (role: TemplateFieldRole): number => fields.filter(field => field.role === role).length
  if (countOf('question') !== 1) return '需要且只能有一个「问题」字段'
  if (countOf('answer') !== 1) return '需要且只能有一个「答案」字段'
  if (countOf('extra') > 1) return '「扩展」字段最多一个'

  const hasEmptyName = fields.some(field => !field.name || !field.name.trim())
  if (hasEmptyName) return '字段名称不能为空'

  const hasTooLongName = fields.some(field => field.name.trim().length > MAX_FIELD_NAME_LENGTH)
  if (hasTooLongName) return `字段名称最多 ${MAX_FIELD_NAME_LENGTH} 个字`

  return null
}

/** 由现有模板克隆出可编辑的新模板（不可变：返回新对象） */
export function cloneTemplate(
  source: Readonly<CardTemplate>,
  templateId: string,
  name: string
): CardTemplate {
  return {
    templateId,
    userId: source.userId,
    name,
    fields: source.fields.map(field => ({ ...field })),
    createTime: new Date(),
    updateTime: Date.now()
  }
}

/** 取某个角色的自定义显示名（无则返回空串） */
function findFieldName(fields: readonly TemplateField[], role: TemplateFieldRole): string {
  const matched = fields.find(
    field => field && field.role === role && typeof field.name === 'string' && field.name.trim() !== ''
  )
  return matched ? matched.name.trim() : ''
}
