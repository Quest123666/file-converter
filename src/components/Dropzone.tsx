import { Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { ACCEPT_EXTENSIONS } from '../lib/formats'

interface DropzoneProps {
  onFiles: (files: File[]) => void
  compact?: boolean
}

export function Dropzone({ onFiles, compact = false }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    onFiles(Array.from(fileList))
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
      }}
      onDragEnter={(event) => {
        event.preventDefault()
        depth.current += 1
        setDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault()
        depth.current -= 1
        if (depth.current <= 0) setDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        depth.current = 0
        setDragging(false)
        handleFiles(event.dataTransfer.files)
      }}
      className={[
        'group relative flex cursor-pointer select-none flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition',
        compact ? 'gap-2 px-6 py-6' : 'gap-4 px-6 py-16 sm:py-20',
        dragging
          ? 'border-indigo-500 bg-indigo-500/5'
          : 'border-zinc-300 bg-white/60 hover:border-indigo-400 hover:bg-white dark:border-white/15 dark:bg-white/[0.03] dark:hover:border-indigo-400/70 dark:hover:bg-white/[0.06]',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_EXTENSIONS}
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
      <div
        className={[
          'flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/25 transition group-hover:scale-105',
          compact ? 'h-9 w-9' : 'h-14 w-14',
        ].join(' ')}
      >
        <Upload className={compact ? 'h-4 w-4' : 'h-6 w-6'} />
      </div>
      <div>
        <p className={compact ? 'text-sm font-medium' : 'text-base font-semibold sm:text-lg'}>
          {dragging ? '松开即可添加' : '拖拽文件到这里，或点击选择'}
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {compact ? '支持多选与批量转换' : '图片 · PDF · Markdown/HTML/文本 · CSV/TSV/JSON/Excel · 音视频'}
        </p>
      </div>
      {!compact && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="rounded-full border border-zinc-200 px-2.5 py-1 dark:border-white/10">PNG/JPG/WebP/AVIF/BMP/ICO</span>
          <span className="rounded-full border border-zinc-200 px-2.5 py-1 dark:border-white/10">PDF 合并 · 拆分 · 转图片</span>
          <span className="rounded-full border border-zinc-200 px-2.5 py-1 dark:border-white/10">CSV/JSON/XLSX</span>
          <span className="rounded-full border border-zinc-200 px-2.5 py-1 dark:border-white/10">MP4/WebM/GIF/MP3/WAV</span>
        </div>
      )}
    </div>
  )
}
