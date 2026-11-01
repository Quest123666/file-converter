import { FORMAT_BY_ID } from '../formats'
import { buildOutputName } from '../naming'
import type { ConvertContext, ConversionSettings, OutputFile } from '../types'

export interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
}

function abortError(): DOMException {
  return new DOMException('已取消', 'AbortError')
}

/** 解码图片：优先 createImageBitmap（保留 EXIF 方向），失败时退回 <img> */
export async function decodeImage(file: File): Promise<DecodedImage> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { source: bitmap, width: bitmap.width, height: bitmap.height }
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const image = new Image()
      image.decoding = 'async'
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error(`无法解码图片：${file.name}`))
        image.src = url
      })
      const bitmap = await createImageBitmap(image)
      return { source: bitmap, width: bitmap.width, height: bitmap.height }
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`浏览器不支持导出 ${mime}`))),
      mime,
      quality,
    )
  })
}

interface RenderOptions {
  maxSize?: number
  /** 透明区域填充色；为空则保留透明 */
  background?: string | null
}

/** 把图片绘制到画布，按最长边缩放并可选填充背景 */
export function renderToCanvas(image: DecodedImage, options: RenderOptions = {}): HTMLCanvasElement {
  const { maxSize = 0, background = null } = options
  const scale = maxSize > 0 ? Math.min(1, maxSize / Math.max(image.width, image.height)) : 1
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器不支持 Canvas 2D')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  if (background) {
    context.fillStyle = background
    context.fillRect(0, 0, width, height)
  }
  context.drawImage(image.source, 0, 0, width, height)
  return canvas
}

/** 24 位 BMP（无 alpha，透明区域需提前填充背景） */
function encodeBmp(context: CanvasRenderingContext2D, width: number, height: number): Blob {
  const imageData = context.getImageData(0, 0, width, height).data
  const rowSize = Math.floor((24 * width + 31) / 32) * 4
  const pixelSize = rowSize * height
  const buffer = new ArrayBuffer(54 + pixelSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  view.setUint16(0, 0x4d42, true)
  view.setUint32(2, 54 + pixelSize, true)
  view.setUint32(10, 54, true)
  view.setUint32(14, 40, true)
  view.setInt32(18, width, true)
  view.setInt32(22, height, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 24, true)
  view.setUint32(34, pixelSize, true)
  view.setInt32(38, 2835, true)
  view.setInt32(42, 2835, true)

  for (let y = 0; y < height; y += 1) {
    const sourceRow = (height - 1 - y) * width * 4
    let target = 54 + y * rowSize
    for (let x = 0; x < width; x += 1) {
      const i = sourceRow + x * 4
      bytes[target] = imageData[i + 2]
      bytes[target + 1] = imageData[i + 1]
      bytes[target + 2] = imageData[i]
      target += 3
    }
  }
  return new Blob([buffer], { type: 'image/bmp' })
}

/** ICO 容器：多尺寸 PNG 载荷（Vista+ 支持） */
async function encodeIco(image: DecodedImage): Promise<Blob> {
  const sizes = [16, 32, 48, 64, 128, 256]
  const entries: Array<{ size: number; data: Uint8Array }> = []
  for (const size of sizes) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器不支持 Canvas 2D')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    const scale = Math.min(size / image.width, size / image.height)
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    context.drawImage(
      image.source,
      Math.round((size - width) / 2),
      Math.round((size - height) / 2),
      width,
      height,
    )
    const blob = await canvasToBlob(canvas, 'image/png')
    entries.push({ size, data: new Uint8Array(await blob.arrayBuffer()) })
  }

  const headerSize = 6 + entries.length * 16
  const buffer = new ArrayBuffer(headerSize + entries.reduce((total, entry) => total + entry.data.length, 0))
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  view.setUint16(0, 0, true)
  view.setUint16(2, 1, true)
  view.setUint16(4, entries.length, true)

  let offset = headerSize
  entries.forEach((entry, index) => {
    const base = 6 + index * 16
    view.setUint8(base, entry.size >= 256 ? 0 : entry.size)
    view.setUint8(base + 1, entry.size >= 256 ? 0 : entry.size)
    view.setUint8(base + 2, 0)
    view.setUint8(base + 3, 0)
    view.setUint16(base + 4, 1, true)
    view.setUint16(base + 6, 32, true)
    view.setUint32(base + 8, entry.data.length, true)
    view.setUint32(base + 12, offset, true)
    bytes.set(entry.data, offset)
    offset += entry.data.length
  })
  return new Blob([buffer], { type: 'image/x-icon' })
}

async function encodeAvif(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器不支持 Canvas 2D')
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const module = await import('@jsquash/avif/encode')
  const buffer = await module.default(imageData, { quality })
  return new Blob([buffer], { type: 'image/avif' })
}

function flattenColor(settings: ConversionSettings): string {
  return settings.image.background || '#ffffff'
}

/** 图片 → 图片（PNG/JPG/WebP/AVIF/BMP/ICO） */
export async function convertImage(ctx: ConvertContext): Promise<OutputFile[]> {
  const file = ctx.files[0]
  const target = FORMAT_BY_ID[ctx.target]
  if (!target) throw new Error(`未知目标格式：${ctx.target}`)
  ctx.onProgress(0.08)
  const image = await decodeImage(file)
  if (ctx.signal.aborted) throw abortError()
  ctx.onProgress(0.4)

  const needsOpaque = target.id === 'jpg' || target.id === 'bmp'
  const maxSize = target.id === 'ico' ? 0 : ctx.settings.image.maxSize
  const canvas = renderToCanvas(image, {
    maxSize,
    background: needsOpaque ? flattenColor(ctx.settings) : null,
  })
  const quality = Math.min(1, Math.max(0.01, ctx.settings.image.quality / 100))

  let blob: Blob
  if (target.id === 'ico') {
    blob = await encodeIco(image)
  } else if (target.id === 'bmp') {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器不支持 Canvas 2D')
    blob = encodeBmp(context, canvas.width, canvas.height)
  } else if (target.id === 'avif') {
    ctx.onProgress(0.7)
    blob = await encodeAvif(canvas, ctx.settings.image.quality)
  } else {
    const mime = target.id === 'png' ? 'image/png' : target.id === 'webp' ? 'image/webp' : 'image/jpeg'
    blob = await canvasToBlob(canvas, mime, target.id === 'png' ? undefined : quality)
  }

  if (ctx.signal.aborted) throw abortError()
  ctx.onProgress(1)
  return [{ name: buildOutputName(file.name, target.ext), blob }]
}
