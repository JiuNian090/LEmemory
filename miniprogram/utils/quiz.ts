/**
 * 测验题型相关纯函数（选择题 / 填空题 / 拼写题）
 *
 * 不依赖 wx API，可被 node 直接运行验证。
 */

export type QuizMode = 'choice' | 'cloze' | 'spelling'

/** 题型中文名 */
export const QUIZ_MODE_LABELS: Record<QuizMode, string> = {
  choice: '选择题',
  cloze: '填空题',
  spelling: '拼写题'
}

/** 选择题备选项数量 */
export const QUIZ_OPTION_COUNT = 4

/** 凑不成选择题时至少需要的选项数 */
export const MIN_QUIZ_OPTIONS = 2

/** 填空题挖空的占位符 */
export const CLOZE_BLANK = '____'

/** 归一化答案：去掉全部空白并统一小写，便于比对 */
export function normalizeAnswer(text: string): string {
  return (text || '').replace(/\s+/g, '').toLowerCase()
}

/** 判断题型答卷是否正确（空输入一律算错） */
export function isAnswerCorrect(input: string, expected: string): boolean {
  const normalizedInput = normalizeAnswer(input)
  return normalizedInput.length > 0 && normalizedInput === normalizeAnswer(expected)
}

/**
 * 生成选择题选项：正确答案 + 若干干扰项，整体打乱后返回。
 * 干扰项取自同组其它卡片的背面，自动去重（按归一化文本）并与正确答案不同。
 * 干扰项不足时返回的数组长度会小于 count，调用方需自行判断是否可用。
 */
export function buildQuizOptions(
  correct: string,
  pool: readonly string[],
  count: number = QUIZ_OPTION_COUNT,
  random: () => number = Math.random
): string[] {
  const seen = new Set<string>([normalizeAnswer(correct)])
  const distractors: string[] = []
  const limit = Math.max(1, count - 1)

  for (const candidate of shuffle(pool, random)) {
    const key = normalizeAnswer(candidate)
    if (!key || seen.has(key)) continue
    seen.add(key)
    distractors.push(candidate)
    if (distractors.length >= limit) break
  }

  return shuffle([correct, ...distractors], random)
}

export interface ClozeQuestion {
  /** 挖空后的背面文本 */
  display: string
  /** 被挖掉的片段（即为答案） */
  answer: string
  /** 提示文案，如「2 字」 */
  hint: string
}

/**
 * 由背面文本生成填空题：随机挖掉其中一个「局部片段」。
 * 若背面整体就是一个片段（挖掉等于拼写题）或没有足够长的片段，返回 null。
 */
export function buildCloze(back: string, random: () => number = Math.random): ClozeQuestion | null {
  const text = (back || '').trim()
  if (!text) return null

  const candidates = collectClozeCandidates(text)
  if (candidates.length === 0) return null

  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length))
  const target = candidates[index]

  return {
    display: `${text.slice(0, target.start)}${CLOZE_BLANK}${text.slice(target.end)}`,
    answer: target.word,
    hint: `${target.word.length} 字`
  }
}

interface ClozeCandidate {
  word: string
  start: number
  end: number
}

/** 可挖空的片段：长度 >= 2，且不是整段文本本身 */
function collectClozeCandidates(text: string): ClozeCandidate[] {
  const candidates: ClozeCandidate[] = []
  const pattern = new RegExp(TOKEN_SOURCE, 'g')
  let match = pattern.exec(text)

  while (match) {
    const word = match[0]
    const start = match.index
    const end = start + word.length
    const isWholeText = start === 0 && end === text.length
    if (word.length >= 2 && !isWholeText) {
      candidates.push({ word, start, end })
    }
    match = pattern.exec(text)
  }

  return candidates
}

/** 以空白/标点切片的字符类（不含引号等易错字符） */
const TOKEN_SOURCE = '[^\\s,，、;；:：.!?。！？/|()（）\\[\\]【】]+'

/** Fisher-Yates 洗牌，返回新数组 */
function shuffle<T>(list: readonly T[], random: () => number): T[] {
  const result = list.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)))
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }
  return result
}
