import { type ChildProcess } from 'node:child_process'
import {
  createBrowserSession,
  ensurePageServer,
  loadHashReport,
  type BrowserKind,
} from './browser-automation.ts'

type CorpusMeta = {
  id: string
  language: string
  title: string
  min_width?: number
  max_width?: number
  default_width?: number
}

type CorpusReport = {
  status: 'ready' | 'error'
  requestId?: string
  corpusId?: string
  title?: string
  width?: number
  predictedHeight?: number
  actualHeight?: number
  diffPx?: number
  predictedLineCount?: number
  browserLineCount?: number
  message?: string
}

function parseStringFlag(name: string): string | null {
  const prefix = `--${name}=`
  const arg = process.argv.find(value => value.startsWith(prefix))
  return arg === undefined ? null : arg.slice(prefix.length)
}

function parseNumberFlag(name: string, fallback: number): number {
  const raw = parseStringFlag(name)
  if (raw === null) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid value for --${name}: ${raw}`)
  }
  return parsed
}

function parseBrowser(value: string | null): BrowserKind {
  const browser = (value ?? process.env['CORPUS_CHECK_BROWSER'] ?? 'chrome').toLowerCase()
  if (browser !== 'chrome' && browser !== 'safari') {
    throw new Error(`Unsupported browser ${browser}; expected chrome or safari`)
  }
  return browser
}

async function loadSources(): Promise<CorpusMeta[]> {
  return await Bun.file('corpora/sources.json').json()
}

function getTargetWidths(meta: CorpusMeta): number[] {
  const widths = process.argv.slice(2)
    .filter(arg => !arg.startsWith('--'))
    .map(arg => Number.parseInt(arg, 10))
    .filter(width => Number.isFinite(width))

  if (widths.length > 0) return widths

  const min = meta.min_width ?? 300
  const max = meta.max_width ?? 900
  const preferred = [min, Math.max(min, Math.min(max, meta.default_width ?? 600)), max]
  return [...new Set(preferred)]
}

function printReport(report: CorpusReport): void {
  if (report.status === 'error') {
    console.log(`error: ${report.message ?? 'unknown error'}`)
    return
  }

  const width = report.width ?? 0
  const diff = Math.round(report.diffPx ?? 0)
  const predicted = Math.round(report.predictedHeight ?? 0)
  const actual = Math.round(report.actualHeight ?? 0)
  const lines = report.predictedLineCount !== undefined && report.browserLineCount !== undefined
    ? `${report.predictedLineCount}/${report.browserLineCount}`
    : '-'

  console.log(
    `width ${width}: diff ${diff > 0 ? '+' : ''}${diff}px | height ${predicted}/${actual} | lines ${lines}`,
  )
}

let serverProcess: ChildProcess | null = null
const browser = parseBrowser(parseStringFlag('browser'))
const port = parseNumberFlag('port', Number.parseInt(process.env['CORPUS_CHECK_PORT'] ?? '3210', 10))
const sources = await loadSources()
const id = parseStringFlag('id')

if (id === null) {
  throw new Error(`Missing --id. Available corpora: ${sources.map(source => source.id).join(', ')}`)
}

const meta = sources.find(source => source.id === id)
if (meta === undefined) {
  throw new Error(`Unknown corpus ${id}. Available corpora: ${sources.map(source => source.id).join(', ')}`)
}

const session = createBrowserSession(browser)

try {
  const pageServer = await ensurePageServer(port, '/corpus', process.cwd())
  serverProcess = pageServer.process
  const baseUrl = `${pageServer.baseUrl}/corpus`
  console.log(`${meta.id} (${meta.language}) — ${meta.title}`)

  for (const width of getTargetWidths(meta)) {
    const requestId = `${Date.now()}-${width}-${Math.random().toString(36).slice(2)}`
    const url =
      `${baseUrl}?id=${encodeURIComponent(meta.id)}` +
      `&width=${width}` +
      `&report=1` +
      `&requestId=${encodeURIComponent(requestId)}`

    const report = await loadHashReport<CorpusReport>(session, url, requestId, browser)
    printReport(report)
    if (report.status === 'error') {
      process.exitCode = 1
      break
    }
  }
} finally {
  session.close()
  serverProcess?.kill()
}
