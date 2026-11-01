import type { Category, FormatDef } from './types'

export const CATEGORY_META: Record<Category, { label: string; description: string }> = {
  image: { label: '图片', description: 'PNG · JPG · WebP · AVIF · BMP · ICO · PDF' },
  pdf: { label: 'PDF', description: '合并 · 拆分 · 转图片' },
  doc: { label: '文档', description: 'Markdown · HTML · 纯文本' },
  data: { label: '表格', description: 'CSV · TSV · JSON · XLSX' },
  media: { label: '音视频', description: 'MP4 · WebM · GIF · MP3 · WAV' },
}

export const FORMATS: FormatDef[] = [
  // 图片
  { id: 'png', label: 'PNG', category: 'image', ext: 'png', mime: 'image/png', decodable: true, encodable: true },
  { id: 'jpg', label: 'JPG', category: 'image', ext: 'jpg', mime: 'image/jpeg', decodable: true, encodable: true },
  { id: 'webp', label: 'WebP', category: 'image', ext: 'webp', mime: 'image/webp', decodable: true, encodable: true },
  { id: 'avif', label: 'AVIF', category: 'image', ext: 'avif', mime: 'image/avif', decodable: true, encodable: true },
  { id: 'bmp', label: 'BMP', category: 'image', ext: 'bmp', mime: 'image/bmp', decodable: true, encodable: true },
  { id: 'ico', label: 'ICO', category: 'image', ext: 'ico', mime: 'image/x-icon', decodable: true, encodable: true },
  { id: 'gif', label: 'GIF', category: 'image', ext: 'gif', mime: 'image/gif', decodable: true, encodable: true },

  // PDF
  { id: 'pdf', label: 'PDF', category: 'pdf', ext: 'pdf', mime: 'application/pdf', decodable: true, encodable: true },

  // 文档
  { id: 'md', label: 'Markdown', category: 'doc', ext: 'md', mime: 'text/markdown', decodable: true, encodable: true },
  { id: 'html', label: 'HTML', category: 'doc', ext: 'html', mime: 'text/html', decodable: true, encodable: true },
  { id: 'txt', label: '纯文本', category: 'doc', ext: 'txt', mime: 'text/plain', decodable: true, encodable: true },

  // 表格
  { id: 'csv', label: 'CSV', category: 'data', ext: 'csv', mime: 'text/csv', decodable: true, encodable: true },
  { id: 'tsv', label: 'TSV', category: 'data', ext: 'tsv', mime: 'text/tab-separated-values', decodable: true, encodable: true },
  { id: 'json', label: 'JSON', category: 'data', ext: 'json', mime: 'application/json', decodable: true, encodable: true },
  { id: 'xlsx', label: 'Excel', category: 'data', ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', decodable: true, encodable: true },
  { id: 'xls', label: 'Excel 97', category: 'data', ext: 'xls', mime: 'application/vnd.ms-excel', decodable: true, encodable: false },

  // 音视频
  { id: 'mp4', label: 'MP4', category: 'media', ext: 'mp4', mime: 'video/mp4', decodable: true, encodable: true },
  { id: 'webm', label: 'WebM', category: 'media', ext: 'webm', mime: 'video/webm', decodable: true, encodable: true },
  { id: 'mov', label: 'MOV', category: 'media', ext: 'mov', mime: 'video/quicktime', decodable: true, encodable: false },
  { id: 'mkv', label: 'MKV', category: 'media', ext: 'mkv', mime: 'video/x-matroska', decodable: true, encodable: false },
  { id: 'avi', label: 'AVI', category: 'media', ext: 'avi', mime: 'video/x-msvideo', decodable: true, encodable: false },
  { id: 'mp3', label: 'MP3', category: 'media', ext: 'mp3', mime: 'audio/mpeg', decodable: true, encodable: true },
  { id: 'wav', label: 'WAV', category: 'media', ext: 'wav', mime: 'audio/wav', decodable: true, encodable: true },
  { id: 'm4a', label: 'M4A', category: 'media', ext: 'm4a', mime: 'audio/mp4', decodable: true, encodable: false },
  { id: 'ogg', label: 'OGG', category: 'media', ext: 'ogg', mime: 'audio/ogg', decodable: true, encodable: false },
]

export const FORMAT_BY_ID: Record<string, FormatDef> = Object.fromEntries(
  FORMATS.map((format) => [format.id, format]),
)

const EXT_ALIASES: Record<string, string> = {
  jpeg: 'jpg',
  jpe: 'jpg',
  markdown: 'md',
  htm: 'html',
  mpeg: 'mp4',
  mpg: 'mp4',
  '7z': '7z',
}

export function extensionOf(name: string): string {
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index + 1).toLowerCase() : ''
}

export function detectFormatByName(name: string): FormatDef | null {
  const ext = extensionOf(name)
  const id = EXT_ALIASES[ext] ?? ext
  return FORMAT_BY_ID[id] ?? null
}

/** 允许的输入扩展名，供文件选择框使用 */
export const ACCEPT_EXTENSIONS = Array.from(
  new Set(
    FORMATS.filter((format) => format.decodable).flatMap((format) => {
      const extensions = [format.ext]
      if (format.id === 'jpg') extensions.push('jpeg', 'jpe')
      if (format.id === 'md') extensions.push('markdown')
      if (format.id === 'html') extensions.push('htm')
      return extensions.map((extension) => `.${extension}`)
    }),
  ),
).join(',')

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
