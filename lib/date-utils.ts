import { addDays } from 'date-fns'

const JST_TIME_ZONE = 'Asia/Tokyo'
const jstDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: JST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function formatToJstParts(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  const parts = jstDateFormatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  const day = parts.find((part) => part.type === 'day')?.value ?? '01'

  return { year, month, day }
}

export function getJstDateKey(value: Date | string) {
  const { year, month, day } = formatToJstParts(value)
  return `${year}-${month}-${day}`
}

export function getJstDayRange(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00+09:00`)
  const end = new Date(`${dateKey}T23:59:59.999+09:00`)
  return { start, end }
}

export function getTodayJstDateKey() {
  return getJstDateKey(new Date())
}

export function getTodayJstRange() {
  return getJstDayRange(getTodayJstDateKey())
}

export function getDateRangeStart(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+09:00`)
}

export function getDateRangeEnd(dateKey: string) {
  return new Date(`${dateKey}T23:59:59.999+09:00`)
}

export function normalizeDateRange(startDate: string, endDate?: string | null) {
  const normalizedEnd = endDate && endDate >= startDate ? endDate : startDate
  return {
    startDate,
    endDate: normalizedEnd,
  }
}

export function enumerateDateKeys(startDate: string, endDate?: string | null) {
  const { startDate: normalizedStart, endDate: normalizedEnd } = normalizeDateRange(startDate, endDate)
  const result: string[] = []
  let cursor = getDateRangeStart(normalizedStart)
  const rangeEnd = getDateRangeStart(normalizedEnd)

  while (cursor <= rangeEnd) {
    result.push(getJstDateKey(cursor))
    cursor = addDays(cursor, 1)
  }

  return result
}

export function eventOverlapsDateRange(startAt: string, endAt: string | null | undefined, dateKey: string) {
  const dayRange = getJstDayRange(dateKey)
  const start = new Date(startAt)
  const end = endAt ? new Date(endAt) : start

  return start <= dayRange.end && end >= dayRange.start
}

export function formatDateRangeLabel(startDate: string, endDate?: string | null) {
  const { startDate: normalizedStart, endDate: normalizedEnd } = normalizeDateRange(startDate, endDate)
  if (normalizedStart === normalizedEnd) return normalizedStart
  return `${normalizedStart} - ${normalizedEnd}`
}
