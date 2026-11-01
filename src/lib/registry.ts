import { FORMAT_BY_ID } from './formats'
import type { Converter, TargetOption } from './types'
import { convertImage } from './convert/image'
import { imagesToPdf, mergePdf, pdfToImages, splitPdf } from './convert/pdf'
import {
  htmlToMarkdown,
  htmlToText,
  markdownToHtml,
  markdownToText,
  textToHtml,
  textToMarkdown,
} from './convert/docs'
import { tableToText, textToWorkbook, workbookToText } from './convert/data'
import { convertMedia } from './convert/media'

const IMAGE_TARGETS = ['png', 'jpg', 'webp', 'avif', 'bmp', 'ico']
const VIDEO_SOURCES = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'gif']
const AUDIO_SOURCES = ['mp3', 'wav', 'm4a', 'ogg']
const VIDEO_TARGETS = ['mp4', 'webm', 'gif', 'mp3', 'wav']
const AUDIO_TARGETS = ['mp3', 'wav']

const ORDER: Record<string, number> = {
  png: 0,
  jpg: 1,
  webp: 2,
  avif: 3,
  bmp: 4,
  ico: 5,
  pdf: 6,
  'pdf-split': 7,
  'pdf-merge': 8,
  html: 9,
  txt: 10,
  md: 11,
  csv: 12,
  tsv: 13,
  json: 14,
  xlsx: 15,
  mp4: 16,
  webm: 17,
  gif: 18,
  mp3: 19,
  wav: 20,
}

function imageConverters(): Converter[] {
  const list: Converter[] = []
  for (const source of [...IMAGE_TARGETS, 'gif']) {
    for (const target of IMAGE_TARGETS) {
      list.push({
        id: `image-${source}-${target}`,
        from: source,
        to: target,
        run: convertImage,
      })
    }
    list.push({ id: `image-${source}-pdf`, from: source, to: 'pdf', multi: true, run: imagesToPdf })
  }
  return list
}

const CONVERTERS: Converter[] = [
  ...imageConverters(),
  { id: 'pdf-png', from: 'pdf', to: 'png', run: pdfToImages },
  { id: 'pdf-jpg', from: 'pdf', to: 'jpg', run: pdfToImages },
  { id: 'pdf-split', from: 'pdf', to: 'pdf-split', run: splitPdf },
  { id: 'pdf-merge', from: 'pdf', to: 'pdf-merge', multi: true, run: mergePdf },

  { id: 'md-html', from: 'md', to: 'html', run: markdownToHtml },
  { id: 'md-txt', from: 'md', to: 'txt', run: markdownToText },
  { id: 'html-md', from: 'html', to: 'md', run: htmlToMarkdown },
  { id: 'html-txt', from: 'html', to: 'txt', run: htmlToText },
  { id: 'txt-md', from: 'txt', to: 'md', run: textToMarkdown },
  { id: 'txt-html', from: 'txt', to: 'html', run: textToHtml },

  { id: 'csv-tsv', from: 'csv', to: 'tsv', run: tableToText },
  { id: 'csv-json', from: 'csv', to: 'json', run: tableToText },
  { id: 'csv-xlsx', from: 'csv', to: 'xlsx', run: textToWorkbook },
  { id: 'tsv-csv', from: 'tsv', to: 'csv', run: tableToText },
  { id: 'tsv-json', from: 'tsv', to: 'json', run: tableToText },
  { id: 'tsv-xlsx', from: 'tsv', to: 'xlsx', run: textToWorkbook },
  { id: 'json-csv', from: 'json', to: 'csv', run: tableToText },
  { id: 'json-tsv', from: 'json', to: 'tsv', run: tableToText },
  { id: 'json-xlsx', from: 'json', to: 'xlsx', run: textToWorkbook },
  { id: 'xlsx-csv', from: 'xlsx', to: 'csv', run: workbookToText },
  { id: 'xlsx-tsv', from: 'xlsx', to: 'tsv', run: workbookToText },
  { id: 'xlsx-json', from: 'xlsx', to: 'json', run: workbookToText },
  { id: 'xls-csv', from: 'xls', to: 'csv', run: workbookToText },
  { id: 'xls-tsv', from: 'xls', to: 'tsv', run: workbookToText },
  { id: 'xls-json', from: 'xls', to: 'json', run: workbookToText },
]

for (const source of VIDEO_SOURCES) {
  for (const target of VIDEO_TARGETS) {
    CONVERTERS.push({ id: `media-${source}-${target}`, from: source, to: target, run: convertMedia })
  }
}
for (const source of AUDIO_SOURCES) {
  for (const target of AUDIO_TARGETS) {
    CONVERTERS.push({ id: `media-${source}-${target}`, from: source, to: target, run: convertMedia })
  }
}

export function labelFor(targetId: string): string {
  if (targetId === 'pdf-split') return '拆分为多个 PDF'
  if (targetId === 'pdf-merge') return '合并为一个 PDF'
  return FORMAT_BY_ID[targetId]?.label ?? targetId
}

export function descriptionFor(targetId: string): string {
  if (targetId === 'pdf-split') return '每页生成一个 PDF'
  if (targetId === 'pdf-merge') return '把选中的 PDF 合成一份'
  if (targetId === 'pdf') return '每张图片一页'
  if (targetId === 'html') return '带样式的独立网页'
  if (targetId === 'json') return '对象数组，适合程序处理'
  if (targetId === 'xlsx') return 'Excel 工作簿'
  if (targetId === 'gif') return '动图，可设帧率'
  return ''
}

export function findConverter(from: string, to: string): Converter | null {
  return CONVERTERS.find((converter) => converter.from === from && converter.to === to) ?? null
}

export function isSupportedSource(formatId: string): boolean {
  return CONVERTERS.some((converter) => converter.from === formatId)
}

export function targetsFor(sourceId: string, fileCount: number): TargetOption[] {
  const options = CONVERTERS.filter((converter) => {
    if (converter.from !== sourceId) return false
    if (converter.to === 'pdf-merge') return fileCount > 1
    if (FORMAT_BY_ID[sourceId]?.category !== 'media' && converter.to === sourceId) return false
    return true
  })
  const unique = new Map<string, TargetOption>()
  for (const converter of options) {
    if (!unique.has(converter.to)) {
      unique.set(converter.to, {
        id: converter.to,
        label: labelFor(converter.to),
        description: descriptionFor(converter.to),
      })
    }
  }
  return Array.from(unique.values()).sort((a, b) => (ORDER[a.id] ?? 99) - (ORDER[b.id] ?? 99))
}

/** 每种输入格式最常用的目标格式 */
const PREFERRED: Record<string, string> = {
  png: 'webp',
  jpg: 'webp',
  webp: 'jpg',
  avif: 'webp',
  bmp: 'png',
  ico: 'png',
  gif: 'mp4',
  pdf: 'png',
  md: 'html',
  html: 'md',
  txt: 'html',
  csv: 'json',
  tsv: 'csv',
  json: 'csv',
  xlsx: 'csv',
  xls: 'csv',
  mp4: 'webm',
  webm: 'mp4',
  mov: 'mp4',
  mkv: 'mp4',
  avi: 'mp4',
  mp3: 'wav',
  wav: 'mp3',
  m4a: 'mp3',
  ogg: 'mp3',
}

export function defaultTargetFor(sourceId: string, targets: TargetOption[]): string {
  const preferred = PREFERRED[sourceId]
  if (preferred && targets.some((target) => target.id === preferred)) return preferred
  return targets[0]?.id ?? ''
}
