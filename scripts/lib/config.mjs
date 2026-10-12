import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const DEFAULT_REPO = 'openJiuwen-ai/sciencediscovery'

function splitList(value) {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** @returns {{ owner: string, name: string, fullName: string }} */
export function parseRepo(slug) {
  const [owner, name] = slug.split('/')
  if (!owner || !name) throw new Error(`Invalid repo slug: ${slug}`)
  return { owner, name, fullName: `${owner}/${name}` }
}

function loadExistingConfig(outDir) {
  const file = path.join(outDir, 'config.json')
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Resolve runtime configuration.
 *
 * Secrets (GITHUB_TOKEN) are only ever read from the environment and are
 * never written to any output file.
 */
export function loadConfig(outDir) {
  const existing = loadExistingConfig(outDir)

  // Only MONITOR_REPO changes the target. GITHUB_REPOSITORY is intentionally
  // ignored: in CI it points at the site repo, not the monitored project.
  const repo = parseRepo(process.env.MONITOR_REPO || DEFAULT_REPO)

  const maintainers = splitList(process.env.MONITOR_MAINTAINERS)
  const internalOrgs = splitList(process.env.MONITOR_INTERNAL_ORGS)
  const bots = splitList(process.env.MONITOR_BOTS)

  /** @type {import('../src/lib/monitor/types.ts').MonitorConfig} */
  const config = {
    maintainers: maintainers.length ? maintainers : (existing?.maintainers ?? []),
    internalOrgs: internalOrgs.length
      ? internalOrgs
      : (existing?.internalOrgs ?? [repo.owner]),
    bots: bots.length
      ? bots
      : (existing?.bots ?? [
          'dependabot[bot]',
          'github-actions[bot]',
          'renovate[bot]',
          'codecov[bot]',
          'copilot[bot]',
          'openjiuwen-sync-bot[bot]',
          'openjiuwen-release-bot[bot]',
          'openjiuwen-collaboration-bot[bot]',
        ]),
    overdueThresholdHours: Number(
      process.env.MONITOR_OVERDUE_HOURS ?? existing?.overdueThresholdHours ?? 168
    ),
    longOpenIssueDays: Number(
      process.env.MONITOR_LONG_OPEN_DAYS ?? existing?.longOpenIssueDays ?? 30
    ),
  }

  return {
    repo,
    config,
    token: process.env.GITHUB_TOKEN ?? process.env.MONITOR_TOKEN ?? '',
    outDir: outDir,
    maxListPages: Number(process.env.MONITOR_MAX_LIST_PAGES ?? 20),
    maxDetailItems: Number(process.env.MONITOR_MAX_DETAIL_ITEMS ?? 0),
    detailWindowDays: Number(process.env.MONITOR_DETAIL_WINDOW_DAYS ?? 180),
    schemaVersion: 1,
  }
}