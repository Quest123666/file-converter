import { describe, expect, it } from 'vitest'
import { detectFormatByName, extensionOf, formatSize } from '../formats'
import { buildOutputName, safeName } from '../naming'
import { parsePageSelection } from '../pages'

describe('格式识别', () => {
  it('识别常见扩展名与别名', () => {
    expect(detectFormatByName('photo.JPEG')?.id).toBe('jpg')
    expect(detectFormatByName('readme.markdown')?.id).toBe('md')
    expect(detectFormatByName('page.htm')?.id).toBe('html')
    expect(detectFormatByName('video.MOV')?.id).toBe('mov')
    expect(detectFormatByName('table.xlsx')?.id).toBe('xlsx')
  })

  it('未知扩展名返回 null', () => {
    expect(detectFormatByName('archive.rar')).toBeNull()
    expect(detectFormatByName('no-extension')).toBeNull()
  })

  it('提取扩展名', () => {
    expect(extensionOf('a.b.PNG')).toBe('png')
    expect(extensionOf('plain')).toBe('')
  })
})

describe('输出命名', () => {
  it('替换扩展名并追加后缀', () => {
    expect(buildOutputName('holiday.png', 'webp')).toBe('holiday.webp')
    expect(buildOutputName('holiday.jpeg', 'pdf', 'page-2')).toBe('holiday-page-2.pdf')
  })

  it('清理文件名中的非法字符', () => {
    expect(safeName('a/b:c*?"<>|')).toBe('a_b_c______')
    expect(safeName('   ')).toBe('output')
  })
})

describe('页码解析', () => {
  it('空输入表示全部页面', () => {
    expect(parsePageSelection('', 5)).toEqual([0, 1, 2, 3, 4])
  })

  it('支持范围、单页与越界过滤', () => {
    expect(parsePageSelection('1-3,5', 6)).toEqual([0, 1, 2, 4])
    expect(parsePageSelection('9', 3)).toEqual([])
    expect(parsePageSelection('3-1', 4)).toEqual([0, 1, 2])
    expect(parsePageSelection('2,2,4', 4)).toEqual([1, 3])
  })
})

describe('体积格式化', () => {
  it('按量级输出单位', () => {
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(2048)).toBe('2.0 KB')
    expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
