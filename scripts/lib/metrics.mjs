/** Classification rules and metric computation shared by the collector. */

export const INTERNAL_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])
export const EXTERNAL_ASSOCIATIONS = new Set([
  'CONTRIBUTOR',
  'FIRST_TIME_CONTRIBUTOR',
  'NONE',
  'MANNEQUIN',
])

/**
 * @param {string} login
 * @param {string|undefined} userType GitHub user `type` (e.g. "Bot")
 * @param {import('./config.mjs').MonitorConfig} config
 */
export function isBot(login, userType, config) {
  if (!login) return false
  if (userType === 'Bot') return true
  if (login.endsWith('[bot]')) return true
  return config.bots.includes(login)
}

/**
 * Determine whether a contributor is internal (maintainer/org member) or
 * external. Never guesses: unknown associations become "unknown".
 */
export function classify(login, association, userType, config) {
  if (isBot(login, userType, config)) return 'unknown'
  if (login && config.maintainers.includes(login)) return 'internal'
  if (INTERNAL_ASSOCIATIONS.has(association)) return 'internal'
  if (EXTERNAL_ASSOCIATIONS.has(association)) return 'external'
  return 'unknown'
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null
  if (sorted.length === 1) return sorted[0]
  const idx = (sorted.length - 1) * p
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)
}

/** @param {number[]} values */
export function durationStats(values) {
  const clean = values.filter((v) => Number.isFinite(v))
  if (clean.length === 0) {
    return { avgHours: null, medianHours: null, p90Hours: null, sampleSize: 0 }
  }
  const sorted = [...clean].sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  const round = (v) => (v === null ? null : Math.round(v * 10) / 10)
  return {
    avgHours: round(sum / sorted.length),
    medianHours: round(percentile(sorted, 0.5)),
    p90Hours: round(percentile(sorted, 0.9)),
    sampleSize: sorted.length,
  }
}

export function hoursBetween(fromIso, toIso) {
  const from = new Date(fromIso).getTime()
  const to = new Date(toIso).getTime()
  if (Number.isNaN(from) || Number.isNaN(to)) return null
  return Math.max(0, (to - from) / 3_600_000)
}

/**
 * Earliest valid human response to an item.
 * Excludes the author's own comments and bot replies; PR reviews are included.
 *
 * @param {{ login: string, type?: string }} author
 * @param {{ user: { login: string, type?: string }, created_at: string,
 *           submitted_at?: string, state?: string }[]} comments
 * @param {import('./config.mjs').MonitorConfig} config
 */
export function firstResponseAt(author, comments, config) {
  let earliest = null
  for (const c of comments ?? []) {
    const login = c.user?.login
    if (!login) continue
    if (login === author.login) continue
    if (isBot(login, c.user?.type, config)) continue
    // Only human replies count; `COMMENTED` reviews that are empty are still
    // a signal, so we keep all non-bot, non-author entries.
    const at = c.created_at ?? c.submitted_at
    if (!at) continue
    if (!earliest || new Date(at) < new Date(earliest)) earliest = at
  }
  return earliest
}

export function toComposition(records) {
  const out = { internal: 0, external: 0, unknown: 0 }
  for (const r of records) out[r.contributionType] += 1
  return out
}

export function round1(v) {
  return v === null || v === undefined ? null : Math.round(v * 10) / 10
}