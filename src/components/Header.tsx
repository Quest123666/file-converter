import { Download, Moon, Settings, Sun } from 'lucide-react'

interface HeaderProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onOpenSettings: () => void
  onDownloadAll: () => void
  hasResults: boolean
  busy: boolean
}

export function Header({ theme, onToggleTheme, onOpenSettings, onDownloadAll, hasResults, busy }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-[#08090d]/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-lg shadow-indigo-500/20">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 8h11l-2.5-2.5M20 16H9l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight sm:text-base">File Converter</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">本地转换 · 文件不上传</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {busy && (
            <span className="hidden items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-600 sm:flex dark:text-indigo-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
              转换中
            </span>
          )}
          <button
            type="button"
            onClick={onDownloadAll}
            disabled={!hasResults}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">打包下载</span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10"
            aria-label="转换参数"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10"
            aria-label="切换深浅色"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  )
}
