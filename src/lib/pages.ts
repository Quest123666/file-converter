/** 解析 "1-3,5" 形式的页码；空字符串表示全部 */
export function parsePageSelection(input: string, total: number): number[] {
  const trimmed = input.trim()
  if (!trimmed) return Array.from({ length: total }, (_, index) => index)
  const result = new Set<number>()
  for (const part of trimmed.split(',')) {
    const token = part.trim()
    if (!token) continue
    const range = token.match(/^(\d+)-(\d+)$/)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      for (let page = Math.min(start, end); page <= Math.max(start, end); page += 1) {
        if (page >= 1 && page <= total) result.add(page - 1)
      }
      continue
    }
    if (/^\d+$/.test(token)) {
      const page = Number(token)
      if (page >= 1 && page <= total) result.add(page - 1)
    }
  }
  return Array.from(result).sort((a, b) => a - b)
}
