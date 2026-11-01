import { buildOutputName } from '../naming'
import type { ConvertContext, OutputFile } from '../types'

const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm'

let instance: { terminate: () => void } | null = null
let loading: Promise<unknown> | null = null
let activeProgress: ((value: number) => void) | null = null

function abortError(): DOMException {
  return new DOMException('已取消', 'AbortError')
}

/** 懒加载单线程 FFmpeg 内核（首次约 30MB，来自 CDN） */
async function loadFFmpeg(): Promise<any> {
  if (instance) return instance
  if (loading) return loading
  loading = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    const { toBlobURL } = await import('@ffmpeg/util')
    const ffmpeg = new FFmpeg()
    ffmpeg.on('progress', ({ progress }: { progress: number }) => {
      activeProgress?.(Math.min(0.97, Math.max(0.02, progress)))
    })
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    instance = ffmpeg
    return ffmpeg
  })()
  try {
    return await loading
  } catch (error) {
    loading = null
    instance = null
    throw error
  }
}

function qualityArgs(quality: 'high' | 'balanced' | 'small'): { crf: string; preset: string; audioQ: string } {
  if (quality === 'high') return { crf: '20', preset: 'medium', audioQ: '1' }
  if (quality === 'small') return { crf: '28', preset: 'veryfast', audioQ: '5' }
  return { crf: '23', preset: 'veryfast', audioQ: '3' }
}

function scaleFilter(resolution: string): string[] {
  const height = resolution === '1080' ? '1080' : resolution === '720' ? '720' : resolution === '480' ? '480' : null
  return height ? ['-vf', `scale=-2:${height}`] : []
}

/** 音视频转换：MP4 / WebM / GIF / MP3 / WAV */
export async function convertMedia(ctx: ConvertContext): Promise<OutputFile[]> {
  const file = ctx.files[0]
  const ffmpeg = await loadFFmpeg()
  activeProgress = ctx.onProgress
  ctx.onProgress(0.02)

  if (ctx.signal.aborted) throw abortError()

  const inputName = `input${file.name.includes('.') ? `.${file.name.split('.').pop()}` : ''}`
  const targetExt = ctx.target
  const outputName = `output.${targetExt}`
  const args: string[] = []

  if (targetExt === 'gif') {
    const fps = Math.min(30, Math.max(5, ctx.settings.media.fps))
    const height = ctx.settings.media.resolution === 'original' ? 480 : ctx.settings.media.resolution
    args.push(
      '-i',
      inputName,
      '-vf',
      `fps=${fps},scale=-2:${height}:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
      '-loop',
      '0',
      outputName,
    )
  } else if (targetExt === 'mp3') {
    args.push('-i', inputName, '-vn', '-c:a', 'libmp3lame', '-q:a', qualityArgs(ctx.settings.media.quality).audioQ, outputName)
  } else if (targetExt === 'wav') {
    args.push('-i', inputName, '-vn', '-c:a', 'pcm_s16le', outputName)
  } else if (targetExt === 'webm') {
    const preset = qualityArgs(ctx.settings.media.quality)
    args.push(
      '-i',
      inputName,
      ...scaleFilter(ctx.settings.media.resolution),
      '-c:v',
      'libvpx-vp9',
      '-crf',
      preset.crf,
      '-b:v',
      '0',
      '-deadline',
      'realtime',
      '-cpu-used',
      '5',
      '-c:a',
      'libopus',
      outputName,
    )
  } else {
    const preset = qualityArgs(ctx.settings.media.quality)
    args.push(
      '-i',
      inputName,
      ...scaleFilter(ctx.settings.media.resolution),
      '-c:v',
      'libx264',
      '-preset',
      preset.preset,
      '-crf',
      preset.crf,
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      outputName,
    )
  }

  try {
    await ffmpeg.writeFile(inputName, await (await import('@ffmpeg/util')).fetchFile(file))
    const exec = ffmpeg.exec(args)
    const aborted = new Promise<never>((_resolve, reject) => {
      ctx.signal.addEventListener(
        'abort',
        () => {
          try {
            ffmpeg.terminate()
          } catch {
            /* 终止时内核状态可能已失效 */
          }
          instance = null
          loading = null
          reject(abortError())
        },
        { once: true },
      )
    })
    await Promise.race([exec, aborted])
    if (ctx.signal.aborted) throw abortError()
    const data = (await ffmpeg.readFile(outputName)) as Uint8Array
    const blob = new Blob([new Uint8Array(data)], { type: mimeOf(targetExt) })
    ctx.onProgress(1)
    return [{ name: buildOutputName(file.name, targetExt), blob }]
  } finally {
    activeProgress = null
    try {
      await ffmpeg.deleteFile(inputName)
      await ffmpeg.deleteFile(outputName)
    } catch {
      /* 文件可能未生成或内核已重建 */
    }
  }
}

function mimeOf(extension: string): string {
  const map: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    gif: 'image/gif',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
  }
  return map[extension] ?? 'application/octet-stream'
}
