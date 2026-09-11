/**
 * 卡牌数据的 .xlsx / .xls 表格解析（SheetJS）
 *
 * 只读取第一个工作表，取前两列（或表头指定的列序）；
 * 「二维行 → 卡牌」的规则与 CSV 文本解析共用（utils/csv.ts 的 rowsToCards）。
 */
import * as XLSX from 'xlsx'
import { rowsToCards, type CsvCardRow } from './csv'

/** 文件是否为 Excel 表格（按扩展名判断） */
export function isSpreadsheetFile(fileName: string): boolean {
  return /\.(xlsx|xls)$/i.test(fileName)
}

/** 从 xlsx/xls 的二进制内容解析卡牌；解析失败或没有有效行时返回空数组 */
export function parseCardsFromXlsx(data: ArrayBuffer): CsvCardRow[] {
  try {
    const workbook = XLSX.read(data, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return []

    const sheet = workbook.Sheets[sheetName]
    if (!sheet) return []

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: ''
    })

    return rowsToCards(rows.map(row => row.map(cellToString)))
  } catch (err) {
    console.error('[XLSX] 表格解析失败', err)
    return []
  }
}

/** 单元格值转字符串（空值转空串） */
function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return ''
  return String(cell)
}
