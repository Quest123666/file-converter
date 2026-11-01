export type Category = 'image' | 'pdf' | 'doc' | 'data' | 'media'

export type JobStatus = 'pending' | 'running' | 'done' | 'error' | 'canceled'

export interface FormatDef {
  /** 稳定的格式 id，用于转换器匹配 */
  id: string
  /** 展示名称 */
  label: string
  /** 所属分类 */
  category: Category
  /** 输出扩展名（不含点） */
  ext: string
  /** MIME 类型 */
  mime: string
  /** 能否作为输入 */
  decodable: boolean
  /** 能否作为输出 */
  encodable: boolean
}

export interface TargetOption {
  id: string
  label: string
  description?: string
}

export interface OutputFile {
  name: string
  blob: Blob
}

export interface ConversionSettings {
  image: {
    quality: number
    maxSize: number
    background: string
  }
  pdf: {
    pageSize: 'fit' | 'a4' | 'letter'
    orientation: 'auto' | 'portrait' | 'landscape'
    dpi: number
    pages: string
  }
  doc: {
    title: string
  }
  data: {
    delimiter: ',' | ';' | '\t'
    header: boolean
  }
  media: {
    quality: 'high' | 'balanced' | 'small'
    resolution: 'original' | '1080' | '720' | '480'
    fps: number
  }
}

export interface ConvertContext {
  files: File[]
  target: string
  settings: ConversionSettings
  onProgress: (value: number) => void
  signal: AbortSignal
}

export interface Converter {
  id: string
  from: string
  to: string
  /** 是否接受多个输入文件（如 PDF 合并） */
  multi?: boolean
  run: (ctx: ConvertContext) => Promise<OutputFile[]>
}

export interface Job {
  id: string
  files: File[]
  sourceFormat: string
  targets: TargetOption[]
  target: string
  status: JobStatus
  progress: number
  error: string | null
  results: OutputFile[]
}
