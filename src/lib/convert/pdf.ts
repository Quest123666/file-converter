import { PDFDocument } from 'pdf-lib'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { FORMAT_BY_ID } from '../formats'
import { baseName, buildOutputName } from '../naming'
import { parsePageSelection } from '../pages'
import type { ConvertContext, OutputFile } from '../types'
import { canvasToBlob, decodeImage, renderToCanvas } from './image'

const A4: [number, number] = [595.28, 841.89]
const LETTER: [number, number] = [612, 792]
const MARGIN = 24

function abortError(): DOMException {
  return new DOMException('已取消', 'AbortError')
}

/** 复制成独立的 ArrayBuffer，避免 SharedArrayBuffer 类型与 BlobPart 不兼容 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer as ArrayBuffer
}

/** 图片 → PDF（每张图片一页） */
export async function imagesToPdf(ctx: ConvertContext): Promise<OutputFile[]> {
  const document = await PDFDocument.create()
  const { pageSize, orientation } = ctx.settings.pdf

  for (let index = 0; index < ctx.files.length; index += 1) {
    const file = ctx.files[index]
    if (ctx.signal.aborted) throw abortError()
    const image = await decodeImage(file)
    const canvas = renderToCanvas(image, { maxSize: 4000 })
    const png = await canvasToBlob(canvas, 'image/png')
    const embedded = await document.embedPng(new Uint8Array(await png.arrayBuffer()))

    const natural: [number, number] = [embedded.width * 0.75, embedded.height * 0.75]
    if (pageSize === 'fit') {
      const page = document.addPage([natural[0], natural[1]])
      page.drawImage(embedded, { x: 0, y: 0, width: natural[0], height: natural[1] })
    } else {
      const base = pageSize === 'a4' ? A4 : LETTER
      const landscape =
        orientation === 'landscape' || (orientation === 'auto' && natural[0] > natural[1])
      const pageWidth = landscape ? base[1] : base[0]
      const pageHeight = landscape ? base[0] : base[1]
      const page = document.addPage([pageWidth, pageHeight])
      const scale = Math.min(
        (pageWidth - MARGIN * 2) / natural[0],
        (pageHeight - MARGIN * 2) / natural[1],
      )
      const width = natural[0] * scale
      const height = natural[1] * scale
      page.drawImage(embedded, {
        x: (pageWidth - width) / 2,
        y: (pageHeight - height) / 2,
        width,
        height,
      })
    }
    ctx.onProgress((index + 1) / ctx.files.length)
  }

  const bytes = await document.save()
  const first = ctx.files[0]
  return [
    {
      name: buildOutputName(ctx.files.length > 1 ? `${baseName(first.name)}-collection` : first.name, 'pdf'),
      blob: new Blob([toArrayBuffer(bytes)], { type: 'application/pdf' }),
    },
  ]
}

/** PDF → 图片（逐页渲染，可多输出） */
export async function pdfToImages(ctx: ConvertContext): Promise<OutputFile[]> {
  const target = FORMAT_BY_ID[ctx.target]
  if (!target || target.id === 'pdf') throw new Error('目标格式必须是图片')
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

  const file = ctx.files[0]
  const data = new Uint8Array(await file.arrayBuffer())
  const loadingTask = pdfjs.getDocument({ data })
  const pdfDocument = await loadingTask.promise
  const pages = parsePageSelection(ctx.settings.pdf.pages, pdfDocument.numPages)
  if (pages.length === 0) {
    await loadingTask.destroy()
    throw new Error('页码选择没有匹配到任何页面')
  }
  const outputs: OutputFile[] = []
  const quality = Math.min(1, Math.max(0.01, ctx.settings.image.quality / 100))
  const mime = target.id === 'png' ? 'image/png' : 'image/jpeg'

  for (let index = 0; index < pages.length; index += 1) {
    if (ctx.signal.aborted) {
      await loadingTask.destroy()
      throw abortError()
    }
    const page = await pdfDocument.getPage(pages[index] + 1)
    const viewport = page.getViewport({ scale: ctx.settings.pdf.dpi / 72 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(viewport.width))
    canvas.height = Math.max(1, Math.round(viewport.height))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器不支持 Canvas 2D')
    await page.render({ canvas, canvasContext: context, viewport }).promise
    const blob = await canvasToBlob(canvas, mime, target.id === 'png' ? undefined : quality)
    const suffix = pages.length > 1 ? `page-${pages[index] + 1}` : undefined
    outputs.push({ name: buildOutputName(file.name, target.ext, suffix), blob })
    page.cleanup()
    ctx.onProgress((index + 1) / pages.length)
  }

  await loadingTask.destroy()
  return outputs
}

/** PDF 拆分（每页一个文件；可用页码选择范围） */
export async function splitPdf(ctx: ConvertContext): Promise<OutputFile[]> {
  const file = ctx.files[0]
  const source = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()))
  const pages = parsePageSelection(ctx.settings.pdf.pages, source.getPageCount())
  if (pages.length === 0) throw new Error('页码选择没有匹配到任何页面')
  const outputs: OutputFile[] = []

  for (let index = 0; index < pages.length; index += 1) {
    if (ctx.signal.aborted) throw abortError()
    const document = await PDFDocument.create()
    const [copied] = await document.copyPages(source, [pages[index]])
    document.addPage(copied)
    const bytes = await document.save()
    outputs.push({
      name: buildOutputName(file.name, 'pdf', `p${pages[index] + 1}`),
      blob: new Blob([toArrayBuffer(bytes)], { type: 'application/pdf' }),
    })
    ctx.onProgress((index + 1) / pages.length)
  }
  return outputs
}

/** 多个 PDF 合并为一个 */
export async function mergePdf(ctx: ConvertContext): Promise<OutputFile[]> {
  const merged = await PDFDocument.create()
  for (let index = 0; index < ctx.files.length; index += 1) {
    if (ctx.signal.aborted) throw abortError()
    const source = await PDFDocument.load(new Uint8Array(await ctx.files[index].arrayBuffer()))
    const copied = await merged.copyPages(source, source.getPageIndices())
    copied.forEach((page) => merged.addPage(page))
    ctx.onProgress((index + 1) / ctx.files.length)
  }
  const bytes = await merged.save()
  return [
    {
      name: buildOutputName(ctx.files[0].name, 'pdf', 'merged'),
      blob: new Blob([toArrayBuffer(bytes)], { type: 'application/pdf' }),
    },
  ]
}
