#!/usr/bin/env node
/**
 * GitHub open-source community data collector (multi-repository).
 *
 * Produces the static JSON contract consumed by the frontend:
 *   public/data/index.json                        list of monitored repositories
 *   public/data/config.json                       shared classification rules
 *   public/data/<owner>/<name>/meta.json          per-repo status & provenance
 *   public/data/<owner>/<name>/latest.json        per-repo cumulative snapshot
 *   public/data/<owner>/<name>/history.json       per-repo daily snapshots
 *   public/data/<owner>/<name>/{pulls,issues,contributors}.json
 *
 * Design rules (see the task spec):
 * - Secrets come only from the environment and are never written to output.
 * - A failed step must NOT overwrite the last valid data with zeros.
 * - History only ever appends forward, one point per UTC day.
 * - Distinguish "real zero" from "no sample" by using `null`.
 * - A failure in one repository never aborts the others.
 *
 * Usage:
 *   node scripts/collect.mjs            # local / CI collection
 *   npm run collect
 */

import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from 'node:fs'
import path from 'node:path'

import { GitHubClient } from './lib/github.mjs'
import { loadConfig } from './lib/config.mjs'
import {
  classify,
  isBot,
  toComposition,
  durationStats,
  hoursBetween,
  firstResponseAt,
} from './lib/metrics.mjs'

const OUT_DIR = path.join(process.cwd(), 'public', 'data')
const DAY_MS = 24 * 60 * 60 * 1000

function readJson(file, fallback = null) {
  if (!existsSync(file)) return fallback
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(file, data) {
  const tmp = `${file}.tmp`
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  renameSync(tmp, file)
}

function dayKey(date) {
  return date.toISOString().slice(0, 10)
}

function refOf(repo) {
  return { owner: repo.owner, name: repo.name, fullName: repo.fullName }
}

/** Strongest association seen for a login (internal wins, then any known). */
function stronger(current, next) {
  if (!current) return next
  if (current === 'internal' || next === 'internal') return 'internal'
  if (current === 'external' || next === 'external') return 'external'
  return current
}

async function main() {
  const log = (msg) => console.log(msg)
  const cfg = loadConfig(OUT_DIR)
  const client = new GitHubClient({ token: cfg.token, log })
  const now = new Date()

  const summaries = []
  for (const repo of cfg.repos) {
    try {
      const summary = await collectRepo(repo, cfg, client, now, log)
      if (summary) summaries.push(summary)
    } catch (error) {
      log(`! ${repo.fullName}: ${error?.message ?? error}`)
    }
  }

  // Shared across repos. Public classification rules only — never secrets.
  writeJson(path.join(OUT_DIR, 'config.json'), cfg.config)
  writeJson(path.join(OUT_DIR, 'index.json'), {
    generatedAt: new Date().toISOString(),
    repos: summaries,
  })
  log(`Wrote ${OUT_DIR}`)
}

async function collectRepo(repo, cfg, client, now, log) {
  const repoRef = refOf(repo)
  const full = repoRef.fullName
  const nowIso = now.toISOString()
  const repoDir = path.join(OUT_DIR, repo.owner, repo.name)
  mkdirSync(repoDir, { recursive: true })

  log(`Collecting ${full} (token: ${client.authenticated ? 'yes' : 'no'})`)

  const prevMeta = readJson(path.join(repoDir, 'meta.json'))
  const prevLatest = readJson(path.join(repoDir, 'latest.json'))
  const prevHistory = readJson(path.join(repoDir, 'history.json'), []) ?? []
  const prevPulls = readJson(path.join(repoDir, 'pulls.json'), { items: [] })
  const prevIssues = readJson(path.join(repoDir, 'issues.json'), { items: [] })

  /** @type {{ at: string, scope: string, message: string }[]} */
  const errors = []
  const notes = []
  const fail = (scope, error) => {
    const message = String(error?.message ?? error)
    errors.push({ at: nowIso, scope, message })
    log(`  ! ${scope}: ${message}`)
  }

  // --- repository -----------------------------------------------------------
  let repoInfo = null
  try {
    repoInfo = await client.getJson(`/repos/${full}`)
  } catch (error) {
    fail('repo', error)
  }

  // --- contributors ---------------------------------------------------------
  let contributorRaw = null
  try {
    const { items, truncated } = await client.paginate(
      `/repos/${full}/contributors?anon=0`,
      { maxPages: cfg.maxListPages }
    )
    contributorRaw = items
    if (truncated) notes.push('Contributor list truncated by MONITOR_MAX_LIST_PAGES.')
  } catch (error) {
    fail('contributors', error)
  }

  // --- pull requests --------------------------------------------------------
  let pullsRaw = null
  try {
    const { items, truncated } = await client.paginate(
      `/repos/${full}/pulls?state=all&sort=created&direction=desc`,
      { maxPages: cfg.maxListPages }
    )
    pullsRaw = items
    if (truncated) notes.push('Pull request list truncated by MONITOR_MAX_LIST_PAGES.')
  } catch (error) {
    fail('pulls', error)
  }

  // --- issues (PRs are filtered out; GitHub numbers PRs as issues) ----------
  let issuesRaw = null
  try {
    const { items, truncated } = await client.paginate(
      `/repos/${full}/issues?state=all&sort=created&direction=desc`,
      { maxPages: cfg.maxListPages }
    )
    issuesRaw = items.filter((i) => !i.pull_request)
    if (truncated) notes.push('Issue list truncated by MONITOR_MAX_LIST_PAGES.')
  } catch (error) {
    fail('issues', error)
  }

  // --- first-response details (bounded by rate limit / config budget) --------
  const detailBudget = resolveDetailBudget(cfg, client)
  const details = pullsRaw || issuesRaw ? await fetchDetails() : { pulls: new Set(), issues: new Set() }

  async function fetchDetails() {
    const pullSet = new Set()
    const issueSet = new Set()
    if (detailBudget <= 0) {
      notes.push(
        'First-response detail fetching skipped (no budget). Set MONITOR_MAX_DETAIL_ITEMS or provide a token.'
      )
      return { pulls: pullSet, issues: issueSet }
    }

    const cutoff = new Date(now.getTime() - cfg.detailWindowDays * DAY_MS).getTime()
    const queue = []
    for (const p of pullsRaw ?? []) {
      queue.push({ kind: 'pull', number: p.number, open: p.state === 'open', at: p.created_at })
    }
    for (const i of issuesRaw ?? []) {
      queue.push({ kind: 'issue', number: i.number, open: i.state === 'open', at: i.created_at })
    }
    // Open items first (need it to judge "awaiting response"), then most recent.
    queue.sort((a, b) => {
      if (a.open !== b.open) return a.open ? -1 : 1
      return new Date(b.at) - new Date(a.at)
    })
    const recent = new Set(
      (pullsRaw ?? [])
        .concat(issuesRaw ?? [])
        .filter((x) => new Date(x.created_at).getTime() >= cutoff)
        .map((x) => x.number)
    )
    const ordered = queue.filter((q) => recent.has(q.number)).concat(queue.filter((q) => !recent.has(q.number)))

    let used = 0
    for (const item of ordered) {
      if (used >= detailBudget) {
        break
      }
      try {
        const comments = await client.getJson(
          `/repos/${full}/issues/${item.number}/comments?per_page=100`,
          { allow403: true }
        )
        let reviews = []
        if (item.kind === 'pull') {
          reviews = await client.getJson(
            `/repos/${full}/pulls/${item.number}/reviews?per_page=100`,
            { allow403: true }
          )
        }
        const merged = [...(comments ?? []), ...(reviews ?? [])].map((c) => ({
          user: c.user,
          created_at: c.created_at ?? c.submitted_at,
        }))
        item.comments = merged
        used += 1
        if (item.kind === 'pull') pullSet.add(item.number)
        else issueSet.add(item.number)
      } catch (error) {
        if (error?.name === 'RateLimitError' || error instanceof Error) {
          notes.push(`Stopped first-response detail fetching after ${used} items (${error.message}).`)
          break
        }
      }
      // Attach resolved comment lists back onto the raw records.
      const target = item.kind === 'pull' ? pullsRaw : issuesRaw
      const rec = (target ?? []).find((r) => r.number === item.number)
      if (rec) rec.__comments = item.comments ?? []
    }
    log(`  fetched first-response details for ${used} items`)
    return { pulls: pullSet, issues: issueSet }
  }

  // --- build detail records -------------------------------------------------
  const assocByLogin = new Map()
  const recordAssociation = (login, association) => {
    if (!login) return
    assocByLogin.set(login, stronger(assocByLogin.get(login), association))
  }

  let pullRecords = null
  if (pullsRaw) {
    pullRecords = pullsRaw.map((p) => {
      const author = p.user?.login ?? 'unknown'
      recordAssociation(author, p.author_association)
      const detailed = details.pulls.has(p.number)
      const first = detailed ? firstResponseAt(p.user, p.__comments, cfg.config) : null
      const mergedAt = p.merged_at ?? null
      const state = mergedAt ? 'merged' : p.state === 'open' ? 'open' : 'closed'
      return {
        number: p.number,
        title: p.title ?? '',
        author,
        contributionType: classify(author, p.author_association, p.user?.type, cfg.config),
        state,
        isDraft: Boolean(p.draft),
        createdAt: p.created_at,
        mergedAt,
        closedAt: p.closed_at ?? null,
        firstResponseAt: first,
        firstResponseHours: first ? hoursBetween(p.created_at, first) : null,
        waitingHours: !first && state === 'open' ? hoursBetween(p.created_at, nowIso) : null,
        mergeCycleHours: mergedAt ? hoursBetween(p.created_at, mergedAt) : null,
        detailChecked: detailed,
        labels: (p.labels ?? []).map((l) => l.name),
        url: p.html_url,
      }
    })
  }

  let issueRecords = null
  if (issuesRaw) {
    issueRecords = issuesRaw.map((i) => {
      const author = i.user?.login ?? 'unknown'
      recordAssociation(author, i.author_association)
      const detailed = details.issues.has(i.number)
      const first = detailed ? firstResponseAt(i.user, i.__comments, cfg.config) : null
      return {
        number: i.number,
        title: i.title ?? '',
        author,
        contributionType: classify(author, i.author_association, i.user?.type, cfg.config),
        state: i.state === 'open' ? 'open' : 'closed',
        isPullRequest: false,
        createdAt: i.created_at,
        closedAt: i.closed_at ?? null,
        firstResponseAt: first,
        firstResponseHours: first ? hoursBetween(i.created_at, first) : null,
        waitingHours: !first && i.state === 'open' ? hoursBetween(i.created_at, nowIso) : null,
        closeCycleHours: i.closed_at ? hoursBetween(i.created_at, i.closed_at) : null,
        comments: i.comments ?? 0,
        detailChecked: detailed,
        labels: (i.labels ?? []).map((l) => l.name),
        url: i.html_url,
      }
    })
  }

  // --- metrics --------------------------------------------------------------
  const pullsSection = pullRecords
    ? computePullMetrics(pullRecords, cfg.config)
    : (prevLatest?.pulls ?? null)
  const issuesSection = issueRecords
    ? computeIssueMetrics(issueRecords, cfg.config)
    : (prevLatest?.issues ?? null)
  const contributorsSection =
    pullRecords || issueRecords
      ? computeContributors(pullRecords ?? [], issueRecords ?? [], contributorRaw, assocByLogin, cfg, now)
      : (prevLatest?.contributors ?? null)

  const counters = {
    stars: repoInfo?.stargazers_count ?? prevLatest?.repo?.stars ?? 0,
    forks: repoInfo?.forks_count ?? prevLatest?.repo?.forks ?? 0,
    watchers: repoInfo?.subscribers_count ?? prevLatest?.repo?.watchers ?? 0,
    openIssuesAndPrs: repoInfo?.open_issues_count ?? prevLatest?.repo?.openIssuesAndPrs ?? 0,
  }

  const generatedAt = nowIso
  const latest = {
    generatedAt,
    repo: counters,
    contributors: contributorsSection ?? emptyContributors(),
    pulls: pullsSection ?? emptyPulls(cfg.config),
    issues: issuesSection ?? emptyIssues(cfg.config),
  }

  // --- history (append/replace today's point) -------------------------------
  const history = appendHistory(prevHistory, {
    date: dayKey(now),
    counters,
    pullRecords,
    issueRecords,
    collectedAt: generatedAt,
  })

  // --- status ---------------------------------------------------------------
  const anyData = Boolean(pullRecords || issueRecords)
  const anyError = errors.length > 0
  const status = !anyData
    ? anyError
      ? 'failed'
      : 'empty'
    : anyError
      ? 'partial'
      : 'ok'
  const lastSuccessAt = anyData ? nowIso : (prevMeta?.lastSuccessAt ?? null)

  const monitoringStart = prevMeta?.monitoringStart ?? nowIso
  const meta = {
    schemaVersion: cfg.schemaVersion,
    repo: {
      ...repoRef,
      htmlUrl: repoInfo?.html_url ?? `https://github.com/${full}`,
      description: repoInfo?.description ?? prevMeta?.repo?.description ?? null,
      homepage: repoInfo?.homepage ?? prevMeta?.repo?.homepage ?? null,
      defaultBranch: repoInfo?.default_branch ?? prevMeta?.repo?.defaultBranch ?? 'main',
      createdAt: repoInfo?.created_at ?? prevMeta?.repo?.createdAt ?? '',
      license: repoInfo?.license?.spdx_id ?? prevMeta?.repo?.license ?? null,
      topics: repoInfo?.topics ?? prevMeta?.repo?.topics ?? [],
    },
    monitoringStart,
    lastSuccessAt,
    lastAttemptAt: nowIso,
    status,
    errors,
    tokenConfigured: client.authenticated,
    historyComplete: false,
    notes,
  }

  // --- persist --------------------------------------------------------------
  writeJson(path.join(repoDir, 'meta.json'), meta)
  writeJson(path.join(repoDir, 'latest.json'), latest)
  writeJson(path.join(repoDir, 'history.json'), history)
  writeJson(
    path.join(repoDir, 'pulls.json'),
    pullRecords ? { generatedAt, items: pullRecords } : prevPulls
  )
  writeJson(
    path.join(repoDir, 'issues.json'),
    issueRecords ? { generatedAt, items: issueRecords } : prevIssues
  )
  writeJson(path.join(repoDir, 'contributors.json'), {
    generatedAt: contributorsSection ? generatedAt : (readJson(path.join(repoDir, 'contributors.json'))?.generatedAt ?? null),
    items: contributorsSection ? buildContributorRecords(pullRecords ?? [], issueRecords ?? [], contributorRaw, assocByLogin, cfg) : (readJson(path.join(repoDir, 'contributors.json'))?.items ?? []),
  })

  log(`Status: ${status} | PRs: ${pullsSection?.total ?? '-'} | Issues: ${issuesSection?.total ?? '-'}`)

  // Summary used to build the multi-repo `index.json`.
  return {
    owner: repoRef.owner,
    name: repoRef.name,
    fullName: repoRef.fullName,
    htmlUrl: meta.repo.htmlUrl,
    description: meta.repo.description,
    defaultBranch: meta.repo.defaultBranch,
  }
}

function resolveDetailBudget(cfg, client) {
  if (cfg.maxDetailItems > 0) return cfg.maxDetailItems
  const remaining = client.remaining
  if (remaining === null) return 0
  // Each item costs ~2 requests (comments + reviews); leave a small reserve.
  return Math.max(0, Math.min(3000, Math.floor((remaining - 5) / 2)))
}

/** Open items we positively verified have no human response yet. */
function verifiedUnresponded(records, config) {
  return records.filter(
    (r) =>
      r.state === 'open' &&
      r.detailChecked &&
      r.firstResponseAt === null &&
      r.waitingHours !== null &&
      !isBot(r.author, undefined, config)
  )
}

function computePullMetrics(records, config) {
  const open = records.filter((r) => r.state === 'open')
  const merged = records.filter((r) => r.state === 'merged')
  const closedUnmerged = records.filter((r) => r.state === 'closed')
  const responded = records.filter((r) => r.firstResponseHours !== null)
  const mergedCycle = merged.filter((r) => r.mergeCycleHours !== null)

  const awaiting = verifiedUnresponded(open, config)
  const overdueItems = awaiting
    .filter((r) => r.waitingHours >= config.overdueThresholdHours)
    .sort((a, b) => b.waitingHours - a.waitingHours)
  const externalWaiting = awaiting.filter((r) => r.contributionType === 'external')

  return {
    total: records.length,
    open: open.length,
    merged: merged.length,
    closedUnmerged: closedUnmerged.length,
    composition: toComposition(records),
    awaitingResponse: awaiting.length,
    firstResponse: durationStats(responded.map((r) => r.firstResponseHours)),
    mergeCycle: durationStats(mergedCycle.map((r) => r.mergeCycleHours)),
    overdue: {
      thresholdHours: config.overdueThresholdHours,
      count: overdueItems.length,
      items: overdueItems.slice(0, 50).map(toPending),
    },
    externalMaxWaitHours: externalWaiting.length
      ? Math.max(...externalWaiting.map((r) => r.waitingHours))
      : null,
  }
}

function computeIssueMetrics(records, config) {
  const open = records.filter((r) => r.state === 'open')
  const closed = records.filter((r) => r.state === 'closed')
  const responded = records.filter((r) => r.firstResponseHours !== null)
  const closedCycle = closed.filter((r) => r.closeCycleHours !== null)

  const awaiting = verifiedUnresponded(open, config)
  const overdueItems = awaiting
    .filter((r) => r.waitingHours >= config.overdueThresholdHours)
    .sort((a, b) => b.waitingHours - a.waitingHours)
  // Long-unresolved is age based and does not depend on response details.
  const longOpenItems = open
    .filter(
      (r) =>
        r.waitingHours !== null &&
        r.waitingHours >= config.longOpenIssueDays * 24 &&
        !isBot(r.author, undefined, config)
    )
    .sort((a, b) => b.waitingHours - a.waitingHours)

  return {
    total: records.length,
    open: open.length,
    closed: closed.length,
    composition: toComposition(records),
    awaitingResponse: awaiting.length,
    firstResponse: durationStats(responded.map((r) => r.firstResponseHours)),
    closeCycle: durationStats(closedCycle.map((r) => r.closeCycleHours)),
    overdue: {
      thresholdHours: config.overdueThresholdHours,
      count: overdueItems.length,
      items: overdueItems.slice(0, 50).map(toPending),
    },
    longOpen: {
      thresholdDays: config.longOpenIssueDays,
      count: longOpenItems.length,
      items: longOpenItems.slice(0, 50).map(toPending),
    },
  }
}

function toPending(r) {
  return {
    number: r.number,
    title: r.title,
    author: r.author,
    createdAt: r.createdAt,
    waitingHours: r.waitingHours,
    url: r.url,
  }
}

function computeContributors(pullRecords, issueRecords, contributorRaw, assocByLogin, cfg, now) {
  const logins = new Set()
  for (const r of pullRecords) if (!isBot(r.author, undefined, cfg.config)) logins.add(r.author)
  for (const r of issueRecords) if (!isBot(r.author, undefined, cfg.config)) logins.add(r.author)
  for (const c of contributorRaw ?? []) {
    if (!isBot(c.login, c.type, cfg.config)) logins.add(c.login)
  }

  const firstSeen = new Map()
  const lastSeen = new Map()
  for (const r of [...pullRecords, ...issueRecords]) {
    const t = new Date(r.createdAt).getTime()
    if (!firstSeen.has(r.author) || t < firstSeen.get(r.author)) firstSeen.set(r.author, t)
    if (!lastSeen.has(r.author) || t > lastSeen.get(r.author)) lastSeen.set(r.author, t)
  }

  const cutoff = now.getTime() - 30 * DAY_MS
  let activeLast30d = 0
  let newLast30d = 0
  const composition = { internal: 0, external: 0, unknown: 0 }

  for (const login of logins) {
    const last = lastSeen.get(login)
    const first = firstSeen.get(login)
    if (last !== undefined && last >= cutoff) activeLast30d += 1
    if (first !== undefined && first >= cutoff) newLast30d += 1
    const type = classify(login, assocByLogin.get(login), undefined, cfg.config)
    composition[type] += 1
  }

  return {
    total: logins.size,
    activeLast30d,
    newLast30d,
    composition,
  }
}

function buildContributorRecords(pullRecords, issueRecords, contributorRaw, assocByLogin, cfg) {
  const map = new Map()
  const ensure = (login) => {
    if (!map.has(login)) {
      map.set(login, {
        login,
        contributionType: classify(login, assocByLogin.get(login), undefined, cfg.config),
        isBot: isBot(login, undefined, cfg.config),
        firstContributionAt: null,
        lastContributionAt: null,
        pulls: 0,
        issues: 0,
        reviews: 0,
      })
    }
    return map.get(login)
  }

  for (const r of pullRecords) {
    const c = ensure(r.author)
    c.pulls += 1
    trackSeen(c, r.createdAt)
  }
  for (const r of issueRecords) {
    const c = ensure(r.author)
    c.issues += 1
    trackSeen(c, r.createdAt)
  }
  for (const raw of contributorRaw ?? []) {
    const c = ensure(raw.login)
    c.isBot = isBot(raw.login, raw.type, cfg.config)
  }

  return [...map.values()].sort((a, b) => b.pulls + b.issues - (a.pulls + a.issues))
}

function trackSeen(record, iso) {
  if (!record.firstContributionAt || iso < record.firstContributionAt) {
    record.firstContributionAt = iso
  }
  if (!record.lastContributionAt || iso > record.lastContributionAt) {
    record.lastContributionAt = iso
  }
}

function appendHistory(prevHistory, { date, counters, pullRecords, issueRecords, collectedAt }) {
  const points = (prevHistory ?? []).filter((p) => p.date !== date)
  const dayStart = new Date(`${date}T00:00:00.000Z`).getTime()
  const dayEnd = dayStart + DAY_MS
  const inDay = (iso) => {
    if (!iso) return false
    const t = new Date(iso).getTime()
    return t >= dayStart && t < dayEnd
  }

  const pulls = pullRecords ?? []
  const issues = issueRecords ?? []
  const active = new Set()
  let newPulls = 0
  let mergedPulls = 0
  let closedUnmergedPulls = 0
  let newIssues = 0
  let closedIssues = 0

  for (const p of pulls) {
    if (inDay(p.createdAt)) {
      newPulls += 1
      active.add(p.author)
    }
    if (inDay(p.mergedAt)) mergedPulls += 1
    if (!p.mergedAt && inDay(p.closedAt)) closedUnmergedPulls += 1
  }
  for (const i of issues) {
    if (inDay(i.createdAt)) {
      newIssues += 1
      active.add(i.author)
    }
    if (inDay(i.closedAt)) closedIssues += 1
  }

  points.push({
    date,
    stars: counters.stars,
    forks: counters.forks,
    watchers: counters.watchers,
    openPulls: pullRecords ? pulls.filter((p) => p.state === 'open').length : 0,
    openIssues: issueRecords ? issues.filter((i) => i.state === 'open').length : 0,
    totalPulls: pullRecords ? pulls.length : 0,
    totalIssues: issueRecords ? issues.length : 0,
    newPulls,
    mergedPulls,
    closedUnmergedPulls,
    newIssues,
    closedIssues,
    activeContributors: active.size,
    collectedAt,
  })

  return points.sort((a, b) => a.date.localeCompare(b.date))
}

function emptyContributors() {
  return {
    total: 0,
    activeLast30d: 0,
    newLast30d: 0,
    composition: { internal: 0, external: 0, unknown: 0 },
  }
}

function emptyPulls(config) {
  return {
    total: 0,
    open: 0,
    merged: 0,
    closedUnmerged: 0,
    composition: { internal: 0, external: 0, unknown: 0 },
    awaitingResponse: 0,
    firstResponse: durationStats([]),
    mergeCycle: durationStats([]),
    overdue: { thresholdHours: config.overdueThresholdHours, count: 0, items: [] },
    externalMaxWaitHours: null,
  }
}

function emptyIssues(config) {
  return {
    total: 0,
    open: 0,
    closed: 0,
    composition: { internal: 0, external: 0, unknown: 0 },
    awaitingResponse: 0,
    firstResponse: durationStats([]),
    closeCycle: durationStats([]),
    overdue: { thresholdHours: config.overdueThresholdHours, count: 0, items: [] },
    longOpen: { thresholdDays: config.longOpenIssueDays, count: 0, items: [] },
  }
}

main().catch((error) => {
  console.error('Collection failed:', error)
  process.exitCode = 1
})