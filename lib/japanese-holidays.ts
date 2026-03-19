import { addDays, eachDayOfInterval, format, getDay } from 'date-fns'

type HolidayEntry = {
  month: number
  day: number
  name: string
}

function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, nth: number) {
  const firstDay = new Date(year, monthIndex, 1)
  const offset = (7 + weekday - firstDay.getDay()) % 7
  return 1 + offset + (nth - 1) * 7
}

function springEquinoxDay(year: number) {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}

function autumnEquinoxDay(year: number) {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}

function buildBaseHolidays(year: number) {
  const entries: HolidayEntry[] = [
    { month: 1, day: 1, name: '元日' },
    { month: 1, day: nthWeekdayOfMonth(year, 0, 1, 2), name: '成人の日' },
    { month: 2, day: 11, name: '建国記念の日' },
    { month: 2, day: 23, name: '天皇誕生日' },
    { month: 3, day: springEquinoxDay(year), name: '春分の日' },
    { month: 4, day: 29, name: '昭和の日' },
    { month: 5, day: 3, name: '憲法記念日' },
    { month: 5, day: 4, name: 'みどりの日' },
    { month: 5, day: 5, name: 'こどもの日' },
    { month: 7, day: nthWeekdayOfMonth(year, 6, 1, 3), name: '海の日' },
    { month: 8, day: 11, name: '山の日' },
    { month: 9, day: nthWeekdayOfMonth(year, 8, 1, 3), name: '敬老の日' },
    { month: 9, day: autumnEquinoxDay(year), name: '秋分の日' },
    { month: 10, day: nthWeekdayOfMonth(year, 9, 1, 2), name: 'スポーツの日' },
    { month: 11, day: 3, name: '文化の日' },
    { month: 11, day: 23, name: '勤労感謝の日' },
  ]

  return entries
}

function buildHolidayMapForYear(year: number) {
  const map = new Map<string, string>()
  const baseEntries = buildBaseHolidays(year)

  for (const entry of baseEntries) {
    map.set(format(new Date(year, entry.month - 1, entry.day), 'yyyy-MM-dd'), entry.name)
  }

  const holidayKeys = Array.from(map.keys()).sort()
  for (const key of holidayKeys) {
    const date = new Date(`${key}T00:00:00+09:00`)
    if (getDay(date) !== 0) continue

    let substitute = addDays(date, 1)
    while (map.has(format(substitute, 'yyyy-MM-dd'))) {
      substitute = addDays(substitute, 1)
    }
    map.set(format(substitute, 'yyyy-MM-dd'), '振替休日')
  }

  const days = eachDayOfInterval({
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31),
  })

  for (let index = 1; index < days.length - 1; index += 1) {
    const current = days[index]
    const prevKey = format(days[index - 1], 'yyyy-MM-dd')
    const currentKey = format(current, 'yyyy-MM-dd')
    const nextKey = format(days[index + 1], 'yyyy-MM-dd')
    if (current.getDay() === 0) continue
    if (!map.has(currentKey) && map.has(prevKey) && map.has(nextKey)) {
      map.set(currentKey, '国民の休日')
    }
  }

  return map
}

export function getJapaneseHolidayMap(start: Date, end: Date) {
  const result = new Map<string, string>()
  const startYear = start.getFullYear()
  const endYear = end.getFullYear()

  for (let year = startYear; year <= endYear; year += 1) {
    const yearMap = buildHolidayMapForYear(year)
    for (const [key, name] of yearMap.entries()) {
      if (key >= format(start, 'yyyy-MM-dd') && key <= format(end, 'yyyy-MM-dd')) {
        result.set(key, name)
      }
    }
  }

  return result
}

export function getJapaneseHolidayName(date: Date) {
  const key = format(date, 'yyyy-MM-dd')
  return buildHolidayMapForYear(date.getFullYear()).get(key) ?? null
}
