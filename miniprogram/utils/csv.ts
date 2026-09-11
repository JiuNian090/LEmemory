/**
 * 卡牌数据的 CSV / 分隔符文本互转（纯函数，不依赖 wx API）
 *
 * 导入：制表符 / 逗号 / 分号 / 竖线分隔，自动检测；支持首行表头；支持 RFC4180 引号转义；
 *      忽略空行与 `#` 注释行。
 * 导出：标准 CSV（逗号分隔、CRLF 行尾、带 front/back 表头）。
 */

export interface CsvCardRow {
  front: string
  back: string
}

export interface DelimitedParseResult {
  cards: CsvCardRow[]
  /** 识别出的分隔符字符，用于提示用户 */
  delimiter: string
}

/** 候选分隔符，按优先级排列（排在前面的在并列时优先） */
const DELIMITER_CANDIDATES = ['\t', ',', ';', '|']

/** 表头关键字（小写比较）→ 列语义。不使用单字母 q/a，避免与真实卡牌内容混淆 */
const FRONT_HEADERS = ['front', 'question', '正面', '问题', '题干']
const BACK_HEADERS = ['back', 'answer', '背面', '答案', '解答']

/** 默认表头行 */
const CSV_HEADER_LINE = 'front,back'

/**
 * 解析分隔符文本为卡牌行；无法识别时返回 null（调用方据此回退到 JSON 或报错）
 */
export function parseCardsFromDelimited(raw: string): DelimitedParseResult | null {
  const text = stripBom(raw)
  const lines = text
    .split(/\r\n|\r|\n/)
    .filter(line => line.trim() !== '' && !line.trim().startsWith('#'))

  if (lines.length === 0) return null

  const delimiter = detectDelimiter(lines)
  if (!delimiter) return null

  const rows = lines.map(line => splitDelimitedLine(line, delimiter))
  const cards = rowsToCards(rows)

  if (cards.length === 0) return null
  return { cards, delimiter }
}

/**
 * 由二维行构建卡牌：自动识别表头并解析列序，默认取前两列。
 * 供 CSV 文本解析与 xlsx 表格解析共用。
 */
export function rowsToCards(rows: readonly (readonly string[])[]): CsvCardRow[] {
  const validRows = rows.filter(row => row.length >= 2)
  if (validRows.length === 0) return []

  const hasHeader = isHeaderRow(validRows[0])
  const order = hasHeader ? resolveColumnOrder(validRows[0]) : { front: 0, back: 1 }
  const dataRows = hasHeader ? validRows.slice(1) : validRows

  const cards: CsvCardRow[] = []
  for (const row of dataRows) {
    const front = (row[order.front] || '').trim()
    const back = (row[order.back] || '').trim()
    if (front && back) {
      cards.push({ front, back })
    }
  }

  return cards
}

/** 把卡牌导出为标准 CSV 文本（CRLF 行尾，含 front/back 表头） */
export function buildCardsCsv(cards: readonly CsvCardRow[]): string {
  const lines = [CSV_HEADER_LINE]
  for (const card of cards) {
    lines.push(`${escapeCsvField(card.front)},${escapeCsvField(card.back)}`)
  }
  return lines.join('\r\n')
}

/** 取出现次数最多、且能切出至少两列的分隔符 */
function detectDelimiter(lines: readonly string[]): string {
  let best = ''
  let bestCount = 0
  for (const candidate of DELIMITER_CANDIDATES) {
    let count = 0
    for (const line of lines) {
      if (splitDelimitedLine(line, candidate).length >= 2) count++
    }
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }
  return bestCount > 0 ? best : ''
}

/** 按 RFC4180 规则切分一行（支持双引号包裹与 "" 转义） */
function splitDelimitedLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }

  fields.push(current)
  return fields
}

/**
 * 首行是否为表头：要求**至少两列**命中表头关键字。
 * 只判一列会把 `a,b` 这类真实数据行当表头丢掉。
 */
function isHeaderRow(row: readonly string[]): boolean {
  return row.filter(column => isHeaderKeyword(column)).length >= 2
}

/** 该列名是否为表头关键字 */
function isHeaderKeyword(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return FRONT_HEADERS.indexOf(normalized) !== -1 || BACK_HEADERS.indexOf(normalized) !== -1
}

/** 由表头解析出 front/back 所在列（缺省回落到前两列） */
function resolveColumnOrder(header: readonly string[]): { front: number; back: number } {
  const normalized = header.map(column => column.trim().toLowerCase())
  const front = normalized.findIndex(column => FRONT_HEADERS.indexOf(column) !== -1)
  const back = normalized.findIndex(column => BACK_HEADERS.indexOf(column) !== -1)
  return {
    front: front === -1 ? 0 : front,
    back: back === -1 ? 1 : back
  }
}

/** 去除 UTF-8 BOM */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/** 需要时用双引号包裹字段，并转义内部双引号 */
function escapeCsvField(value: string): string {
  const text = value == null ? '' : String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}
