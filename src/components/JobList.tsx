import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Download,
  LoaderCircle,
  Play,
  RotateCw,
  Trash,
  X,
} from 'lucide-react'
import { FORMAT_BY_ID, formatSize } from '../lib/formats'
import type { Category, Job } from '../lib/types'

const CATEGORY_STYLES: Record<Category, string> = {
  image: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
  pdf: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  doc: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  data: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  media: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
}

interface JobListProps {
  jobs: Job[]
  onTargetChange: (id: string, target: string) => void
  onConvert: (id: string) => void
  onCancel: (id: string) => void
  onRemove: (id: string) => void
  onDownload: (id: string) => void
}

function statusText(job: Job): string {
  if (job.status === 'running') return `转换中 ${Math.round(job.progress * 100)}%`
  if (job.status === 'done') {
    const size = job.results.reduce((total, file) => total + file.blob.size, 0)
    const count = job.results.length > 1 ? `${job.results.length} 个文件 · ` : ''
    return `完成 · ${count}${formatSize(size)}`
  }
  if (job.status === 'error') return job.error ?? '转换失败'
  if (job.status === 'canceled') return '已取消'
  return '待转换'
}

function StatusIcon({ job }: { job: Job }) {
  if (job.status === 'running') return <LoaderCircle className="h-3.5 w-3.5 animate-spin text-indigo-500" />
  if (job.status === 'done') return <CircleCheck className="h-3.5 w-3.5 text-emerald-500" />
  if (job.status === 'error') return <CircleAlert className="h-3.5 w-3.5 text-rose-500" />
  if (job.status === 'canceled') return <CircleX className="h-3.5 w-3.5 text-zinc-400" />
  return <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
}

export function JobList({ jobs, onTargetChange, onConvert, onCancel, onRemove, onDownload }: JobListProps) {
  return (
    <ul className="space-y-2.5">
      {jobs.map((job) => {
        const format = FORMAT_BY_ID[job.sourceFormat]
        const category = format?.category ?? 'image'
        const displayName =
          job.files.length > 1 ? `合并 ${job.files.length} 个 ${format?.label ?? '文件'}` : job.files[0]?.name
        const totalSize = job.files.reduce((total, file) => total + file.size, 0)
        const running = job.status === 'running'

        return (
          <li
            key={job.id}
            className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-300 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20"
          >
            <div className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap sm:p-4">
              <span
                className={[
                  'inline-flex h-9 min-w-12 shrink-0 items-center justify-center rounded-lg px-2 text-[11px] font-semibold uppercase tracking-wide',
                  CATEGORY_STYLES[category],
                ].join(' ')}
              >
                {format?.ext ?? '?'}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100" title={displayName}>
                  {displayName}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{formatSize(totalSize)}</span>
                  <span className="text-zinc-300 dark:text-zinc-600">·</span>
                  <StatusIcon job={job} />
                  <span className={job.status === 'error' ? 'text-rose-600 dark:text-rose-400' : ''}>
                    {statusText(job)}
                  </span>
                </div>
              </div>

              <select
                value={job.target}
                disabled={running}
                onChange={(event) => onTargetChange(job.id, event.target.value)}
                className="h-9 shrink-0 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 dark:border-white/10 dark:bg-[#12141b] dark:text-zinc-200"
                aria-label="目标格式"
              >
                {job.targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    转 {target.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  if (running) onCancel(job.id)
                  else if (job.status === 'done') onDownload(job.id)
                  else onConvert(job.id)
                }}
                className={[
                  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition',
                  job.status === 'done'
                    ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-sm shadow-indigo-500/20 hover:brightness-110'
                    : running
                      ? 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10'
                      : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200',
                ].join(' ')}
              >
                {job.status === 'done' ? (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    下载
                  </>
                ) : running ? (
                  <>
                    <X className="h-3.5 w-3.5" />
                    取消
                  </>
                ) : job.status === 'error' ? (
                  <>
                    <RotateCw className="h-3.5 w-3.5" />
                    重试
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    转换
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => onRemove(job.id)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-rose-500/10 hover:text-rose-500"
                aria-label="移除"
              >
                <Trash className="h-4 w-4" />
              </button>
            </div>

            {running && (
              <div className="absolute inset-x-0 bottom-0 h-[3px] bg-zinc-100 dark:bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-[width] duration-300"
                  style={{ width: `${Math.max(4, job.progress * 100)}%` }}
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
