import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileStack, Merge, Play, Trash } from 'lucide-react'
import { Dropzone } from './components/Dropzone'
import { Header } from './components/Header'
import { JobList } from './components/JobList'
import { SettingsDrawer } from './components/SettingsDrawer'
import { CATEGORY_META, FORMAT_BY_ID, detectFormatByName, formatSize } from './lib/formats'
import { downloadBlob, downloadZip } from './lib/download'
import { findConverter, isSupportedSource, defaultTargetFor, targetsFor } from './lib/registry'
import { loadSettings, saveSettings } from './lib/settings'
import type { Category, ConversionSettings, Job } from './lib/types'

const CATEGORY_ORDER: Category[] = ['image', 'pdf', 'doc', 'data', 'media']

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return '已取消'
    return error.message || '转换失败'
  }
  return '转换失败'
}

function createJob(files: File[], sourceFormat: string, targets = targetsFor(sourceFormat, files.length)): Job {
  return {
    id: crypto.randomUUID(),
    files,
    sourceFormat,
    targets,
    target: defaultTargetFor(sourceFormat, targets),
    status: 'pending',
    progress: 0,
    error: null,
    results: [],
  }
}

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [filter, setFilter] = useState<'all' | Category>('all')
  const [settings, setSettings] = useState<ConversionSettings>(() => loadSettings())
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)

  const jobsRef = useRef(jobs)
  const settingsRef = useRef(settings)
  const controllers = useRef(new Map<string, AbortController>())

  useEffect(() => {
    jobsRef.current = jobs
  }, [jobs])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem('fc-theme', theme)
    } catch {
      /* 隐私模式下忽略 */
    }
  }, [theme])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const notify = useCallback((message: string) => {
    setToast({ id: Date.now(), message })
  }, [])

  const updateJob = useCallback((id: string, patch: Partial<Job> | ((job: Job) => Partial<Job>)) => {
    setJobs((current) =>
      current.map((job) =>
        job.id === id
          ? { ...job, ...(typeof patch === 'function' ? patch(job) : patch) }
          : job,
      ),
    )
  }, [])

  const addFiles = useCallback(
    (files: File[]) => {
      const accepted: Job[] = []
      const rejected: string[] = []
      const existing = new Set(jobsRef.current.flatMap((job) => job.files.map((file) => `${file.name}:${file.size}:${file.lastModified}`)))

      for (const file of files) {
        const format = detectFormatByName(file.name)
        if (!format || !format.decodable || !isSupportedSource(format.id)) {
          rejected.push(file.name)
          continue
        }
        const signature = `${file.name}:${file.size}:${file.lastModified}`
        if (existing.has(signature)) {
          continue
        }
        existing.add(signature)
        accepted.push(createJob([file], format.id))
      }

      if (accepted.length > 0) setJobs((current) => [...current, ...accepted])
      if (rejected.length > 0) {
        const names = rejected.slice(0, 2).join('、')
        notify(`暂不支持：${names}${rejected.length > 2 ? ` 等 ${rejected.length} 个文件` : ''}`)
      }
    },
    [notify],
  )

  const convertJob = useCallback(
    async (id: string) => {
      const job = jobsRef.current.find((item) => item.id === id)
      if (!job || job.status === 'running') return
      const converter = findConverter(job.sourceFormat, job.target)
      if (!converter) {
        updateJob(id, { status: 'error', error: '这个转换组合暂不支持' })
        return
      }
      const controller = new AbortController()
      controllers.current.set(id, controller)
      updateJob(id, { status: 'running', progress: 0, error: null, results: [] })

      try {
        const results = await converter.run({
          files: job.files,
          target: job.target,
          settings: settingsRef.current,
          signal: controller.signal,
          onProgress: (value) => updateJob(id, { progress: value }),
        })
        updateJob(id, { status: 'done', progress: 1, results })
      } catch (error) {
        if (controller.signal.aborted) {
          updateJob(id, { status: 'canceled', progress: 0 })
        } else {
          updateJob(id, { status: 'error', error: errorMessage(error), progress: 0 })
        }
      } finally {
        controllers.current.delete(id)
      }
    },
    [updateJob],
  )

  const convertAll = useCallback(async () => {
    const pending = jobsRef.current.filter((job) => job.status === 'pending' || job.status === 'error' || job.status === 'canceled')
    if (pending.length === 0) {
      notify('没有待转换的文件')
      return
    }
    for (const job of pending) {
      if (!controllers.current.has(job.id)) {
        await convertJob(job.id)
      }
    }
  }, [convertJob, notify])

  const cancelJob = useCallback((id: string) => {
    controllers.current.get(id)?.abort()
  }, [])

  const removeJob = useCallback((id: string) => {
    controllers.current.get(id)?.abort()
    controllers.current.delete(id)
    setJobs((current) => current.filter((job) => job.id !== id))
  }, [])

  const downloadJob = useCallback(
    (id: string) => {
      const job = jobsRef.current.find((item) => item.id === id)
      if (!job || job.results.length === 0) return
      if (job.results.length === 1) {
        downloadBlob(job.results[0].blob, job.results[0].name)
        return
      }
      const base = job.files[0]?.name.replace(/\.[^.]+$/, '') ?? 'converted'
      void downloadZip(job.results, `${base}-converted.zip`)
    },
    [],
  )

  const downloadAll = useCallback(() => {
    const outputs = jobsRef.current.filter((job) => job.status === 'done').flatMap((job) => job.results)
    if (outputs.length === 0) {
      notify('还没有可下载的转换结果')
      return
    }
    if (outputs.length === 1) {
      downloadBlob(outputs[0].blob, outputs[0].name)
      return
    }
    void downloadZip(outputs, `file-converter-${new Date().toISOString().slice(0, 10)}.zip`)
  }, [notify])

  const mergePdfs = useCallback(() => {
    const pdfJobs = jobsRef.current.filter(
      (job) => FORMAT_BY_ID[job.sourceFormat]?.category === 'pdf' && job.status !== 'running',
    )
    if (pdfJobs.length < 2) {
      notify('至少需要两个 PDF 文件才能合并')
      return
    }
    const files = pdfJobs.flatMap((job) => job.files)
    const job: Job = {
      ...createJob(files, 'pdf'),
      targets: [{ id: 'pdf-merge', label: '合并为一个 PDF', description: '把选中的 PDF 合成一份' }],
      target: 'pdf-merge',
    }
    setJobs((current) => [...current.filter((item) => !pdfJobs.some((pdf) => pdf.id === item.id)), job])
    notify(`已合并 ${pdfJobs.length} 个 PDF，点击转换开始处理`)
  }, [notify])

  const clearDone = useCallback(() => {
    setJobs((current) => current.filter((job) => job.status !== 'done' && job.status !== 'canceled'))
  }, [])

  const visibleJobs = filter === 'all' ? jobs : jobs.filter((job) => FORMAT_BY_ID[job.sourceFormat]?.category === filter)
  const doneJobs = jobs.filter((job) => job.status === 'done')
  const pendingCount = jobs.filter((job) => job.status !== 'running' && job.status !== 'done').length
  const busy = jobs.some((job) => job.status === 'running')
  const pdfCount = jobs.filter((job) => FORMAT_BY_ID[job.sourceFormat]?.category === 'pdf').length
  const outputCount = doneJobs.reduce((total, job) => total + job.results.length, 0)
  const outputSize = doneJobs.reduce(
    (total, job) => total + job.results.reduce((sum, file) => sum + file.blob.size, 0),
    0,
  )

  return (
    <div className="bg-grid min-h-screen dark:bg-grid-dark">
      <Header
        theme={theme}
        onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
        onOpenSettings={() => setSettingsOpen(true)}
        onDownloadAll={downloadAll}
        hasResults={doneJobs.length > 0}
        busy={busy}
      />

      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        {jobs.length === 0 && (
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-indigo-200/70 bg-indigo-50/70 px-3 py-1 text-[11px] font-medium text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-300">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              100% 浏览器内处理 · 不上传服务器
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
              把文件换成你需要的格式
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
              图片、PDF、Markdown/HTML、表格、音视频，拖进来即可批量转换。敏感文件不离开这台电脑。
            </p>
          </div>
        )}

        <Dropzone onFiles={addFiles} compact={jobs.length > 0} />

        {jobs.length > 0 && (
          <div className="mt-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={[
                  'h-8 rounded-full px-3 text-xs font-medium transition',
                  filter === 'all'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                    : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10',
                ].join(' ')}
              >
                全部 {jobs.length}
              </button>
              {CATEGORY_ORDER.filter((category) => jobs.some((job) => FORMAT_BY_ID[job.sourceFormat]?.category === category)).map(
                (category) => {
                  const count = jobs.filter((job) => FORMAT_BY_ID[job.sourceFormat]?.category === category).length
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setFilter(category)}
                      className={[
                        'h-8 rounded-full px-3 text-xs font-medium transition',
                        filter === category
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                          : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10',
                      ].join(' ')}
                    >
                      {CATEGORY_META[category].label} {count}
                    </button>
                  )
                },
              )}

              <div className="ml-auto flex items-center gap-2">
                {pdfCount >= 2 && (
                  <button
                    type="button"
                    onClick={mergePdfs}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10"
                  >
                    <Merge className="h-3.5 w-3.5" />
                    合并 PDF
                  </button>
                )}
                {doneJobs.length > 0 && (
                  <button
                    type="button"
                    onClick={clearDone}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10"
                  >
                    <Trash className="h-3.5 w-3.5" />
                    清空已完成
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void convertAll()}
                  disabled={pendingCount === 0 || busy}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 px-3 text-xs font-semibold text-white shadow-sm shadow-indigo-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Play className="h-3.5 w-3.5" />
                  全部转换{pendingCount > 0 ? `（${pendingCount}）` : ''}
                </button>
              </div>
            </div>

            {visibleJobs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center text-sm text-zinc-500 dark:border-white/15 dark:text-zinc-400">
                当前分类下没有文件
              </div>
            ) : (
              <JobList
                jobs={visibleJobs}
                onTargetChange={(id, target) =>
                  updateJob(id, () => ({
                    target,
                    status: 'pending',
                    progress: 0,
                    error: null,
                    results: [],
                  }) as Partial<Job>)
                }
                onConvert={(id) => void convertJob(id)}
                onCancel={cancelJob}
                onRemove={removeJob}
                onDownload={downloadJob}
              />
            )}

            {outputCount > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                <span className="inline-flex items-center gap-1.5">
                  <FileStack className="h-4 w-4" />
                  已完成 {outputCount} 个文件 · {formatSize(outputSize)}
                </span>
                <button
                  type="button"
                  onClick={downloadAll}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 font-semibold text-white transition hover:bg-emerald-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  打包下载
                </button>
              </div>
            )}
          </div>
        )}

        <footer className="mt-14 border-t border-zinc-200/70 pt-5 text-center text-[11px] leading-relaxed text-zinc-500 dark:border-white/10 dark:text-zinc-500">
          所有转换都在你的浏览器里完成，不上传、不留存。
          <br />
          音视频转换使用 FFmpeg WebAssembly，首次使用需联网加载约 30MB 引擎；其余功能可离线使用。
        </footer>
      </main>

      <SettingsDrawer
        open={settingsOpen}
        settings={settings}
        onChange={setSettings}
        onClose={() => setSettingsOpen(false)}
      />

      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-700 shadow-lg dark:border-white/10 dark:bg-[#14161d] dark:text-zinc-200">
            {toast.message}
          </div>
        </div>
      )}
    </div>
  )
}
