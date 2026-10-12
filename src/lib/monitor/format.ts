import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'

/** Compact integer formatting, e.g. 12345 -> "12.3k". */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (Math.abs(value) < 1000) return String(value)
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

/** Full integer formatting with thousands separators. */
export function formatExact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

/** Signed delta, e.g. "+12" / "-3". */
export function formatDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value > 0 ? `+${formatExact(value)}` : formatExact(value)
}

export function formatPercent(
  value: number | null | undefined,
  fractionDigits = 1
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(fractionDigits)}%`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'yyyy-MM-dd')
  } catch {
    return '—'
  }
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    // Always render in UTC to match the storage timezone.
    return `${format(parseISO(value), 'yyyy-MM-dd HH:mm')} UTC`
  } catch {
    return '—'
  }
}

export function formatRelative(
  value: string | null | undefined
): string | null {
  if (!value) return null
  try {
    return formatDistanceToNowStrict(parseISO(value), {
      addSuffix: true,
      locale: zhCN,
    })
  } catch {
    return null
  }
}

/** Humanize a duration expressed in hours. */
export function formatDurationHours(
  hours: number | null | undefined
): string {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return '—'
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 48) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

/** Split a byte-free GitHub URL into a short repo label. */
export function shortRepo(fullName: string | null | undefined): string {
  if (!fullName) return '—'
  return fullName
}