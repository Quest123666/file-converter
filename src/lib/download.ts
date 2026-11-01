import { zipSync } from 'fflate'
import type { OutputFile } from './types'

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** 多份结果打成一个 zip 下载 */
export async function downloadZip(files: OutputFile[], zipName: string): Promise<void> {
  const entries: Record<string, Uint8Array> = {}
  for (const file of files) {
    let name = file.name
    let counter = 1
    while (entries[name]) {
      const dot = name.lastIndexOf('.')
      name =
        dot > 0
          ? `${name.slice(0, dot)}-${counter}${name.slice(dot)}`
          : `${name}-${counter}`
      counter += 1
    }
    entries[name] = new Uint8Array(await file.blob.arrayBuffer())
  }
  const zipped = zipSync(entries, { level: 6 })
  downloadBlob(new Blob([zipped], { type: 'application/zip' }), zipName)
}
