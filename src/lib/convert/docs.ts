import { marked } from 'marked'
import TurndownService from 'turndown'
import { buildOutputName } from '../naming'
import type { ConvertContext, OutputFile } from '../types'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function htmlDocument(title: string, body: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  body { max-width: 860px; margin: 48px auto; padding: 0 20px; font: 16px/1.75 system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #1f2937; }
  h1,h2,h3,h4 { line-height: 1.3; margin: 1.6em 0 .6em; }
  h1 { font-size: 2em; } h2 { font-size: 1.5em; } h3 { font-size: 1.2em; }
  p, ul, ol, table { margin: 0 0 1em; }
  code { background: #f3f4f6; border-radius: 4px; padding: .15em .35em; font-size: .92em; }
  pre { background: #f3f4f6; border-radius: 8px; padding: 16px; overflow: auto; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
  th { background: #f9fafb; }
  img { max-width: 100%; }
  blockquote { border-left: 3px solid #d1d5db; margin: 0 0 1em; padding: .2em 1em; color: #4b5563; }
  a { color: #4f46e5; }
</style>
</head>
<body>
${body}
</body>
</html>
`
}

function htmlToPlainText(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html')
  document.querySelectorAll('script, style').forEach((node) => node.remove())
  const text = document.body?.innerText ?? document.body?.textContent ?? ''
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

/** Markdown → HTML */
export async function markdownToHtml(ctx: ConvertContext): Promise<OutputFile[]> {
  const file = ctx.files[0]
  const source = await file.text()
  ctx.onProgress(0.3)
  const body = await marked.parse(source, { gfm: true, breaks: false })
  const title = ctx.settings.doc.title || file.name.replace(/\.[^.]+$/, '')
  ctx.onProgress(1)
  return [
    {
      name: buildOutputName(file.name, 'html'),
      blob: new Blob([htmlDocument(title, body)], { type: 'text/html;charset=utf-8' }),
    },
  ]
}

/** Markdown → 纯文本 */
export async function markdownToText(ctx: ConvertContext): Promise<OutputFile[]> {
  const file = ctx.files[0]
  const source = await file.text()
  ctx.onProgress(0.3)
  const body = await marked.parse(source, { gfm: true })
  const text = htmlToPlainText(body)
  ctx.onProgress(1)
  return [{ name: buildOutputName(file.name, 'txt'), blob: new Blob([text], { type: 'text/plain;charset=utf-8' }) }]
}

/** HTML → Markdown */
export async function htmlToMarkdown(ctx: ConvertContext): Promise<OutputFile[]> {
  const file = ctx.files[0]
  const source = await file.text()
  ctx.onProgress(0.3)
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
  turndown.remove(['script', 'style'])
  const markdown = turndown.turndown(source)
  ctx.onProgress(1)
  return [{ name: buildOutputName(file.name, 'md'), blob: new Blob([markdown], { type: 'text/markdown;charset=utf-8' }) }]
}

/** HTML → 纯文本 */
export async function htmlToText(ctx: ConvertContext): Promise<OutputFile[]> {
  const file = ctx.files[0]
  const source = await file.text()
  ctx.onProgress(0.4)
  const text = htmlToPlainText(source)
  ctx.onProgress(1)
  return [{ name: buildOutputName(file.name, 'txt'), blob: new Blob([text], { type: 'text/plain;charset=utf-8' }) }]
}

/** 纯文本 → Markdown（保留分段，转义会干扰 Markdown 的符号） */
export async function textToMarkdown(ctx: ConvertContext): Promise<OutputFile[]> {
  const file = ctx.files[0]
  const source = await file.text()
  ctx.onProgress(0.5)
  const markdown = source.replace(/\r\n/g, '\n')
  ctx.onProgress(1)
  return [{ name: buildOutputName(file.name, 'md'), blob: new Blob([markdown], { type: 'text/markdown;charset=utf-8' }) }]
}

/** 纯文本 → HTML（按空行分段） */
export async function textToHtml(ctx: ConvertContext): Promise<OutputFile[]> {
  const file = ctx.files[0]
  const source = await file.text()
  ctx.onProgress(0.3)
  const title = ctx.settings.doc.title || file.name.replace(/\.[^.]+$/, '')
  const body = source
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('\n')
  ctx.onProgress(1)
  return [
    {
      name: buildOutputName(file.name, 'html'),
      blob: new Blob([htmlDocument(title, body)], { type: 'text/html;charset=utf-8' }),
    },
  ]
}
