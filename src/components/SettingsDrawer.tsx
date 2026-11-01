import { ChevronDown, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ConversionSettings } from '../lib/types'

interface SettingsDrawerProps {
  open: boolean
  settings: ConversionSettings
  onChange: (settings: ConversionSettings) => void
  onClose: () => void
}

const inputClass =
  'h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-[#12141b] dark:text-zinc-100'
const labelClass = 'text-xs font-medium text-zinc-600 dark:text-zinc-300'

function Section({
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string
  hint: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className="border-b border-zinc-200/70 py-4 dark:border-white/10">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="mt-4 space-y-3">{children}</div>}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  )
}

export function SettingsDrawer({ open, settings, onChange, onClose }: SettingsDrawerProps) {
  const [sections, setSections] = useState<Record<string, boolean>>({
    image: true,
    pdf: true,
    data: true,
    media: true,
    doc: false,
  })

  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const patch = (next: Partial<ConversionSettings>) => {
    onChange({
      ...settings,
      ...next,
      image: { ...settings.image, ...next.image },
      pdf: { ...settings.pdf, ...next.pdf },
      doc: { ...settings.doc, ...next.doc },
      data: { ...settings.data, ...next.data },
      media: { ...settings.media, ...next.media },
    } as ConversionSettings)
  }

  const toggle = (key: string) => setSections((current) => ({ ...current, [key]: !current[key] }))

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="关闭设置"
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0c0e14]">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200/70 px-5 py-4 dark:border-white/10">
          <div>
            <p className="text-base font-semibold">转换参数</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              参数会应用到之后的转换，并保存在本地
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-white/10"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 pb-8">
          <Section
            title="图片"
            hint="JPG / WebP / AVIF 质量、尺寸与透明填充"
            open={sections.image}
            onToggle={() => toggle('image')}
          >
            <Field label={`质量 ${settings.image.quality}`}>
              <input
                type="range"
                min={10}
                max={100}
                step={1}
                value={settings.image.quality}
                onChange={(event) => patch({ image: { ...settings.image, quality: Number(event.target.value) } })}
                className="w-full accent-indigo-500"
              />
            </Field>
            <Field label="最长边（像素，0 表示保持原始尺寸）">
              <input
                type="number"
                min={0}
                max={8000}
                value={settings.image.maxSize}
                onChange={(event) =>
                  patch({ image: { ...settings.image, maxSize: Math.max(0, Number(event.target.value) || 0) } })
                }
                className={inputClass}
              />
            </Field>
            <Field label="透明转 JPG/BMP 时的背景色">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.image.background}
                  onChange={(event) => patch({ image: { ...settings.image, background: event.target.value } })}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-zinc-200 bg-white p-1 dark:border-white/10 dark:bg-[#12141b]"
                />
                <span className="font-mono text-xs text-zinc-500">{settings.image.background}</span>
              </div>
            </Field>
          </Section>

          <Section
            title="PDF"
            hint="页面尺寸、渲染分辨率与页码选择"
            open={sections.pdf}
            onToggle={() => toggle('pdf')}
          >
            <Field label="图片转 PDF 的页面尺寸">
              <select
                value={settings.pdf.pageSize}
                onChange={(event) =>
                  patch({ pdf: { ...settings.pdf, pageSize: event.target.value as ConversionSettings['pdf']['pageSize'] } })
                }
                className={inputClass}
              >
                <option value="fit">跟随图片尺寸</option>
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
              </select>
            </Field>
            <Field label="方向">
              <select
                value={settings.pdf.orientation}
                onChange={(event) =>
                  patch({
                    pdf: { ...settings.pdf, orientation: event.target.value as ConversionSettings['pdf']['orientation'] },
                  })
                }
                className={inputClass}
              >
                <option value="auto">自动</option>
                <option value="portrait">纵向</option>
                <option value="landscape">横向</option>
              </select>
            </Field>
            <Field label="PDF 转图片的渲染 DPI">
              <input
                type="number"
                min={72}
                max={600}
                step={1}
                value={settings.pdf.dpi}
                onChange={(event) =>
                  patch({ pdf: { ...settings.pdf, dpi: Math.min(600, Math.max(72, Number(event.target.value) || 150)) } })
                }
                className={inputClass}
              />
            </Field>
            <Field label="页码（如 1-3,5；留空表示全部）">
              <input
                type="text"
                value={settings.pdf.pages}
                placeholder="1-3,5"
                onChange={(event) => patch({ pdf: { ...settings.pdf, pages: event.target.value } })}
                className={inputClass}
              />
            </Field>
          </Section>

          <Section
            title="表格"
            hint="分隔符与表头识别"
            open={sections.data}
            onToggle={() => toggle('data')}
          >
            <Field label="导出 CSV 的分隔符">
              <select
                value={settings.data.delimiter}
                onChange={(event) =>
                  patch({ data: { ...settings.data, delimiter: event.target.value as ConversionSettings['data']['delimiter'] } })
                }
                className={inputClass}
              >
                <option value=",">逗号 ,</option>
                <option value=";">分号 ;</option>
                <option value={'\t'}>制表符 Tab</option>
              </select>
            </Field>
            <label className="flex items-center gap-2.5 rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-white/10">
              <input
                type="checkbox"
                checked={settings.data.header}
                onChange={(event) => patch({ data: { ...settings.data, header: event.target.checked } })}
                className="h-4 w-4 accent-indigo-500"
              />
              <span className="text-xs text-zinc-600 dark:text-zinc-300">第一行作为表头（转 JSON 时生成对象）</span>
            </label>
          </Section>

          <Section
            title="音视频"
            hint="质量、分辨率与 GIF 帧率（首次使用需联网加载引擎）"
            open={sections.media}
            onToggle={() => toggle('media')}
          >
            <Field label="质量">
              <select
                value={settings.media.quality}
                onChange={(event) =>
                  patch({ media: { ...settings.media, quality: event.target.value as ConversionSettings['media']['quality'] } })
                }
                className={inputClass}
              >
                <option value="high">高（体积较大）</option>
                <option value="balanced">均衡</option>
                <option value="small">小（体积优先）</option>
              </select>
            </Field>
            <Field label="输出分辨率">
              <select
                value={settings.media.resolution}
                onChange={(event) =>
                  patch({
                    media: {
                      ...settings.media,
                      resolution: event.target.value as ConversionSettings['media']['resolution'],
                    },
                  })
                }
                className={inputClass}
              >
                <option value="original">保持原始</option>
                <option value="1080">1080p</option>
                <option value="720">720p</option>
                <option value="480">480p</option>
              </select>
            </Field>
            <Field label={`GIF 帧率 ${settings.media.fps}`}>
              <input
                type="range"
                min={5}
                max={30}
                step={1}
                value={settings.media.fps}
                onChange={(event) => patch({ media: { ...settings.media, fps: Number(event.target.value) } })}
                className="w-full accent-indigo-500"
              />
            </Field>
          </Section>

          <Section
            title="文档"
            hint="导出 HTML 时的页面标题"
            open={sections.doc}
            onToggle={() => toggle('doc')}
          >
            <Field label="HTML 标题（留空则用文件名）">
              <input
                type="text"
                value={settings.doc.title}
                onChange={(event) => patch({ doc: { ...settings.doc, title: event.target.value } })}
                className={inputClass}
                placeholder="文档标题"
              />
            </Field>
          </Section>
        </div>
      </aside>
    </div>
  )
}
