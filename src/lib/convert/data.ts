import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { buildOutputName, safeName } from '../naming'
import type { ConvertContext, OutputFile } from '../types'

interface Table {
  header: string[]
  rows: string[][]
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

async function readRows(file: File, format: string, header: boolean): Promise<Table> {
  if (format === 'xlsx' || format === 'xls') {
    const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })
    const sheets = await readSheets(workbook, header)
    return sheets[0] ?? { header: [], rows: [] }
  }
  if (format === 'json') {
    return jsonToTable(JSON.parse(await file.text()))
  }
  const text = await file.text()
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
    ...(format === 'tsv' ? { delimiter: '\t' } : {}),
  })
  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    throw new Error(`无法解析 ${format.toUpperCase()}：${parsed.errors[0].message}`)
  }
  const rows = parsed.data.map((row) => row.map(cellToString))
  if (!header) return { header: [], rows }
  const [first = [], ...rest] = rows
  return { header: first.map(cellToString), rows: rest }
}

async function readSheets(workbook: XLSX.WorkBook, header: boolean): Promise<Array<Table & { name: string }>> {
  return workbook.SheetNames.map((name) => {
    const raw = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[name], {
      header: 1,
      raw: false,
      defval: '',
    }) as string[][]
    const rows = raw.map((row) => row.map(cellToString))
    if (!header) return { name, header: [], rows }
    const [first = [], ...rest] = rows
    return { name, header: first.map(cellToString), rows: rest }
  })
}

function jsonToTable(value: unknown): Table {
  if (Array.isArray(value)) {
    if (value.length === 0) return { header: [], rows: [] }
    if (value.every((item) => typeof item === 'object' && item !== null && !Array.isArray(item))) {
      const keys = Array.from(
        new Set(value.flatMap((item) => Object.keys(item as Record<string, unknown>)),
        ),
      )
      return {
        header: keys,
        rows: value.map((item) => keys.map((key) => cellToString((item as Record<string, unknown>)[key]))),
      }
    }
    if (value.every(Array.isArray)) {
      const rows = (value as unknown[][]).map((row) => row.map(cellToString))
      const [first = [], ...rest] = rows
      return { header: first, rows: rest }
    }
    return { header: ['value'], rows: value.map((item) => [cellToString(item)]) }
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record)
    return { header: keys, rows: [keys.map((key) => cellToString(record[key]))] }
  }
  return { header: ['value'], rows: [[cellToString(value)]] }
}

function toJson(table: Table, header: boolean): string {
  if (!header) return JSON.stringify(table.rows, null, 2)
  const objects = table.rows.map((row) => {
    const record: Record<string, string> = {}
    table.header.forEach((key, index) => {
      record[key] = row[index] ?? ''
    })
    return record
  })
  return JSON.stringify(objects, null, 2)
}

function toDelimited(table: Table, delimiter: string, header: boolean): string {
  const rows = header && table.header.length > 0 ? [table.header, ...table.rows] : table.rows
  return Papa.unparse(rows, { delimiter })
}

function textBlob(text: string, mime: string): Blob {
  return new Blob([text], { type: `${mime};charset=utf-8` })
}

/** 表格 → CSV/TSV/JSON */
export async function tableToText(ctx: ConvertContext): Promise<OutputFile[]> {
  const file = ctx.files[0]
  const format = file.name.split('.').pop()?.toLowerCase() ?? ''
  const table = await readRows(file, format, ctx.settings.data.header)
  ctx.onProgress(0.6)
  const target = ctx.target
  const outputs: OutputFile[] = []

  if (target === 'json') {
    outputs.push({
      name: buildOutputName(file.name, 'json'),
      blob: textBlob(toJson(table, ctx.settings.data.header), 'application/json'),
    })
  } else {
    const delimiter = target === 'tsv' ? '\t' : ctx.settings.data.delimiter
    outputs.push({
      name: buildOutputName(file.name, target),
      blob: textBlob(toDelimited(table, delimiter, ctx.settings.data.header), 'text/plain'),
    })
  }
  ctx.onProgress(1)
  return outputs
}

/** XLSX/XLS → CSV/TSV/JSON（多工作表时逐表输出） */
export async function workbookToText(ctx: ConvertContext): Promise<OutputFile[]> {
  const file = ctx.files[0]
  const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })
  const sheets = await readSheets(workbook, ctx.settings.data.header)
  const multiple = sheets.length > 1
  const outputs: OutputFile[] = []

  if (ctx.target === 'json') {
    if (!multiple) {
      outputs.push({
        name: buildOutputName(file.name, 'json'),
        blob: textBlob(toJson(sheets[0], ctx.settings.data.header), 'application/json'),
      })
    } else {
      const map = Object.fromEntries(
        sheets.map((sheet) => [
          sheet.name,
          ctx.settings.data.header
            ? tableToObjects(sheet)
            : sheet.rows,
        ]),
      )
      outputs.push({
        name: buildOutputName(file.name, 'json'),
        blob: textBlob(JSON.stringify(map, null, 2), 'application/json'),
      })
    }
  } else {
    const delimiter = ctx.target === 'tsv' ? '\t' : ctx.settings.data.delimiter
    sheets.forEach((sheet) => {
      const suffix = multiple ? safeName(sheet.name) : undefined
      outputs.push({
        name: buildOutputName(file.name, ctx.target, suffix),
        blob: textBlob(toDelimited(sheet, delimiter, ctx.settings.data.header), 'text/plain'),
      })
    })
  }
  ctx.onProgress(1)
  return outputs
}

function tableToObjects(table: Table): Array<Record<string, string>> {
  return table.rows.map((row) => {
    const record: Record<string, string> = {}
    table.header.forEach((key, index) => {
      record[key] = row[index] ?? ''
    })
    return record
  })
}

/** CSV/TSV/JSON/XLSX → XLSX */
export async function textToWorkbook(ctx: ConvertContext): Promise<OutputFile[]> {
  const file = ctx.files[0]
  const format = file.name.split('.').pop()?.toLowerCase() ?? ''
  const table = await readRows(file, format, ctx.settings.data.header)
  const rows = ctx.settings.data.header ? [table.header, ...table.rows] : table.rows
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
  const data = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  ctx.onProgress(1)
  return [
    {
      name: buildOutputName(file.name, 'xlsx'),
      blob: new Blob([data as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    },
  ]
}
