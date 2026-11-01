/** 去掉扩展名，保留原始名称 */
export function baseName(name: string): string {
  const index = name.lastIndexOf('.')
  return index > 0 ? name.slice(0, index) : name
}

/** 去掉路径分隔符与控制字符，避免下载文件名异常 */
export function safeName(name: string): string {
  // oxlint-disable-next-line no-control-regex -- 需要过滤文件名里的控制字符
  return name.replace(/[/\\:*?"<>|\u0000-\u001f]/g, '_').trim() || 'output'
}

export function buildOutputName(originalName: string, extension: string, suffix?: string): string {
  const base = safeName(baseName(originalName))
  return `${base}${suffix ? `-${suffix}` : ''}.${extension}`
}
