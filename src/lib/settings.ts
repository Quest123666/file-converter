import type { ConversionSettings } from './types'

const STORAGE_KEY = 'fc-settings'

export const DEFAULT_SETTINGS: ConversionSettings = {
  image: {
    quality: 82,
    maxSize: 0,
    background: '#ffffff',
  },
  pdf: {
    pageSize: 'fit',
    orientation: 'auto',
    dpi: 150,
    pages: '',
  },
  doc: {
    title: '',
  },
  data: {
    delimiter: ',',
    header: true,
  },
  media: {
    quality: 'balanced',
    resolution: 'original',
    fps: 12,
  },
}

export function loadSettings(): ConversionSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<ConversionSettings>
    return {
      image: { ...DEFAULT_SETTINGS.image, ...parsed.image },
      pdf: { ...DEFAULT_SETTINGS.pdf, ...parsed.pdf },
      doc: { ...DEFAULT_SETTINGS.doc, ...parsed.doc },
      data: { ...DEFAULT_SETTINGS.data, ...parsed.data },
      media: { ...DEFAULT_SETTINGS.media, ...parsed.media },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: ConversionSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* 隐私模式下忽略 */
  }
}
