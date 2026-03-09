import {
  layout,
  layoutWithLines,
  prepareWithSegments,
  type PreparedTextWithSegments,
} from '../src/layout.ts'
import sourcesData from '../corpora/sources.json' with { type: 'json' }
import arRisalatAlGhufranPart1 from '../corpora/ar-risalat-al-ghufran-part-1.txt' with { type: 'text' }
import hiEidgah from '../corpora/hi-eidgah.txt' with { type: 'text' }
import koUnsuJohEunNal from '../corpora/ko-unsu-joh-eun-nal.txt' with { type: 'text' }

type CorpusMeta = {
  id: string
  language: string
  direction?: 'ltr' | 'rtl'
  title: string
  output: string
  font_family?: string
  font_size_px?: number
  line_height_px?: number
  default_width?: number
  min_width?: number
  max_width?: number
}

type CorpusReport = {
  status: 'ready' | 'error'
  requestId?: string
  corpusId?: string
  title?: string
  language?: string
  direction?: string
  width?: number
  contentWidth?: number
  font?: string
  lineHeight?: number
  predictedHeight?: number
  actualHeight?: number
  diffPx?: number
  predictedLineCount?: number
  browserLineCount?: number
  message?: string
}

declare global {
  interface Window {
    __CORPUS_READY__?: boolean
    __CORPUS_REPORT__?: CorpusReport
    __CORPUS_DEBUG__?: {
      corpusId: string
      font: string
      lineHeight: number
      padding: number
      direction: string
      width: number
      contentWidth: number
      getNormalizedText: () => string
      layoutWithLines: (width: number) => ReturnType<typeof layoutWithLines>
    }
  }
}

const book = document.getElementById('book')!
const slider = document.getElementById('slider') as HTMLInputElement
const valLabel = document.getElementById('val')!
const stats = document.getElementById('stats')!
const select = document.getElementById('corpus') as HTMLSelectElement

const PADDING = 40

const params = new URLSearchParams(location.search)
const requestId = params.get('requestId') ?? undefined
const requestedCorpusId = params.get('id')
const requestedWidth = Number.parseInt(params.get('width') ?? '', 10)

const reportEl = document.createElement('pre')
reportEl.id = 'corpus-report'
reportEl.hidden = true
reportEl.dataset['ready'] = '0'
document.body.appendChild(reportEl)

let corpusList: CorpusMeta[] = []
let currentMeta: CorpusMeta | null = null
let currentText = ''
let currentPrepared: PreparedTextWithSegments | null = null

function withRequestId<T extends CorpusReport>(report: T): CorpusReport {
  return requestId === undefined ? report : { ...report, requestId }
}

function publishNavigationReport(report: CorpusReport): void {
  const encoded = encodeURIComponent(JSON.stringify(report))
  history.replaceState(null, '', `${location.pathname}${location.search}#report=${encoded}`)
}

function buildFont(meta: CorpusMeta): string {
  const size = meta.font_size_px ?? 18
  const family = meta.font_family ?? 'serif'
  return `${size}px ${family}`
}

function getLineHeight(meta: CorpusMeta): number {
  return meta.line_height_px ?? Math.round((meta.font_size_px ?? 18) * 1.6)
}

function getDirection(meta: CorpusMeta): 'ltr' | 'rtl' {
  return meta.direction === 'rtl' ? 'rtl' : 'ltr'
}

function estimateBrowserLineCount(actualHeight: number, lineHeight: number): number {
  const contentHeight = Math.max(0, actualHeight - PADDING * 2)
  return Math.max(0, Math.round(contentHeight / lineHeight))
}

function setReport(report: CorpusReport): void {
  reportEl.textContent = JSON.stringify(report)
  reportEl.dataset['ready'] = '1'
  window.__CORPUS_REPORT__ = report
  window.__CORPUS_READY__ = true
  publishNavigationReport(report)
}

function setError(message: string): void {
  stats.textContent = `Error: ${message}`
  setReport(withRequestId({ status: 'error', message }))
}

function updateTitle(meta: CorpusMeta): void {
  document.title = `Pretext — ${meta.title}`
  document.documentElement.lang = meta.language
  document.documentElement.dir = getDirection(meta)
}

function configureControls(meta: CorpusMeta): void {
  slider.min = String(meta.min_width ?? 300)
  slider.max = String(meta.max_width ?? 900)
}

function getInitialWidth(meta: CorpusMeta): number {
  const min = meta.min_width ?? 300
  const max = meta.max_width ?? 900
  const fallback = meta.default_width ?? 600
  const width = Number.isFinite(requestedWidth) ? requestedWidth : fallback
  return Math.max(min, Math.min(max, width))
}

function buildReadyReport(
  meta: CorpusMeta,
  width: number,
  font: string,
  lineHeight: number,
  predictedHeight: number,
  actualHeight: number,
  predictedLineCount: number,
): CorpusReport {
  return withRequestId({
    status: 'ready',
    corpusId: meta.id,
    title: meta.title,
    language: meta.language,
    direction: getDirection(meta),
    width,
    contentWidth: width - PADDING * 2,
    font,
    lineHeight,
    predictedHeight,
    actualHeight,
    diffPx: predictedHeight - actualHeight,
    predictedLineCount,
    browserLineCount: estimateBrowserLineCount(actualHeight, lineHeight),
  })
}

function updateStats(report: CorpusReport, msPretext: number, msDOM: number): void {
  if (report.status !== 'ready') return
  const diff = report.diffPx ?? 0
  const diffText = diff === 0 ? 'exact' : `${diff > 0 ? '+' : ''}${Math.round(diff)}px`
  stats.textContent =
    `${report.title} | Pretext: ${msPretext.toFixed(2)}ms (${Math.round(report.predictedHeight ?? 0)}px)` +
    ` | DOM: ${msDOM.toFixed(1)}ms (${Math.round(report.actualHeight ?? 0)}px)` +
    ` | Diff: ${diffText}` +
    ` | Lines: ${report.predictedLineCount ?? 0}/${report.browserLineCount ?? 0}` +
    ` | ${currentText.length.toLocaleString()} chars`
}

function setWidth(width: number): void {
  if (currentMeta === null || currentPrepared === null) {
    return
  }

  const font = buildFont(currentMeta)
  const lineHeight = getLineHeight(currentMeta)
  const contentWidth = width - PADDING * 2
  const prepared = currentPrepared

  slider.value = String(width)
  valLabel.textContent = `${width}px`

  const t0p = performance.now()
  const predicted = layout(prepared, contentWidth, lineHeight)
  const msPretext = performance.now() - t0p

  const t0d = performance.now()
  book.style.width = `${width}px`
  const actualHeight = book.getBoundingClientRect().height
  const msDOM = performance.now() - t0d

  const predictedHeight = predicted.height + PADDING * 2
  const report = buildReadyReport(
    currentMeta,
    width,
    font,
    lineHeight,
    predictedHeight,
    actualHeight,
    predicted.lineCount,
  )

  window.__CORPUS_DEBUG__ = {
    corpusId: currentMeta.id,
    font,
    lineHeight,
    padding: PADDING,
    direction: getDirection(currentMeta),
    width,
    contentWidth,
    getNormalizedText: () => prepared.segments.join(''),
    layoutWithLines: nextWidth => layoutWithLines(prepared, nextWidth - PADDING * 2, lineHeight),
  }

  updateStats(report, msPretext, msDOM)
  setReport(report)
}

function populateSelect(selectedId: string): void {
  select.textContent = ''
  for (const meta of corpusList) {
    const option = document.createElement('option')
    option.value = meta.id
    option.textContent = `${meta.language} — ${meta.title}`
    option.selected = meta.id === selectedId
    select.appendChild(option)
  }
}

async function loadSources(): Promise<CorpusMeta[]> {
  return sourcesData as CorpusMeta[]
}

async function loadText(meta: CorpusMeta): Promise<string> {
  switch (meta.id) {
    case 'ar-risalat-al-ghufran-part-1':
      return arRisalatAlGhufranPart1
    case 'hi-eidgah':
      return hiEidgah
    case 'ko-unsu-joh-eun-nal':
      return koUnsuJohEunNal
    default:
      throw new Error(`No bundled text import for corpus ${meta.id}`)
  }
}

async function loadCorpus(meta: CorpusMeta): Promise<void> {
  currentMeta = meta
  currentText = await loadText(meta)

  updateTitle(meta)
  configureControls(meta)
  populateSelect(meta.id)

  const font = buildFont(meta)
  const lineHeight = getLineHeight(meta)
  const direction = getDirection(meta)

  book.textContent = currentText
  book.lang = meta.language
  book.dir = direction
  book.style.font = font
  book.style.lineHeight = `${lineHeight}px`
  book.style.padding = `${PADDING}px`

  if ('fonts' in document) {
    await document.fonts.ready
  }

  currentPrepared = prepareWithSegments(currentText, font)
  setWidth(getInitialWidth(meta))
}

function navigateToCorpus(id: string): void {
  const nextParams = new URLSearchParams(location.search)
  nextParams.set('id', id)
  nextParams.delete('width')
  nextParams.delete('requestId')
  nextParams.delete('report')
  nextParams.delete('diagnostic')
  location.search = nextParams.toString()
}

slider.addEventListener('input', () => {
  setWidth(Number.parseInt(slider.value, 10))
})

select.addEventListener('change', () => {
  navigateToCorpus(select.value)
})

window.__CORPUS_READY__ = false
window.__CORPUS_REPORT__ = withRequestId({ status: 'error', message: 'Pending initial layout' })
reportEl.textContent = ''
stats.textContent = 'Loading...'
history.replaceState(null, '', `${location.pathname}${location.search}`)

async function init(): Promise<void> {
  try {
    corpusList = await loadSources()
    if (corpusList.length === 0) {
      throw new Error('No corpora found')
    }

    const selected = corpusList.find(meta => meta.id === requestedCorpusId) ?? corpusList[0]!
    await loadCorpus(selected)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setError(message)
  }
}

void init()
