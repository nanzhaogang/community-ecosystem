import { useState, type ReactNode } from 'react'
import {
  AlertCircle,
  CircleDot,
  GitFork,
  GitPullRequest,
  RefreshCw,
  Star,
  Users,
} from 'lucide-react'
import { getRouteApi } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { IconGithub } from '@/assets/brand-icons'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { activeContributorsSplit } from '@/lib/monitor/derive'
import {
  fetchLiveRepoStats,
  type LiveRepoStats,
} from '@/lib/monitor/live'
import { repoKey, useIssues, usePulls, useRepos } from '@/lib/monitor/data'
import {
  formatDateTime,
  formatExact,
  formatNumber,
  formatPercent,
} from '@/lib/monitor/format'
import { MetricCard } from './components/metric-card'
import { MonitorHeader } from './components/monitor-header'
import { ErrorState, LoadingState } from './components/states'
import { useMonitorBase } from './use-monitor'
import type { TimeRangeSearch } from '@/lib/monitor/ranges'
import type { Composition, RepoSummary } from '@/lib/monitor/types'

const route = getRouteApi('/_authenticated/')

/**
 * The overview always reflects the current state, so it uses one fixed window
 * (the platform's 30-day convention) instead of a user-selectable range.
 */
const FIXED_RANGE: TimeRangeSearch = { range: '30d' }

/** Click-to-open explanation for the "活跃贡献者" metric. */
function ActiveContributorsInfo() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type='button'
          aria-label='活跃贡献者说明'
          className='shrink-0 text-muted-foreground transition-colors hover:text-foreground'
        >
          <AlertCircle className='size-3.5' />
        </button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-72 text-xs leading-relaxed'>
        统计最近 30 天内创建过 PR 或 Issue 的去重作者数（含外部作者）。
      </PopoverContent>
    </Popover>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-center justify-between gap-3 py-1 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='font-medium tabular-nums'>{value}</span>
    </div>
  )
}

/**
 * Internal / external split as plain numbers. Bots ("unknown") are neither, so
 * they are excluded from both sides — matching the config-driven split used by
 * every other page. Only the external value keeps its share of the total; the
 * internal share is usually ~100% and adds noise.
 */
function compositionParts(composition?: Composition) {
  const internal = composition?.internal ?? 0
  const external = composition?.external ?? 0
  const total = internal + external
  return {
    internal: formatExact(internal),
    external:
      total > 0
        ? `${formatExact(external)}（${formatPercent(external / total, 0)}）`
        : formatExact(external),
  }
}

/**
 * One repository rendered as a self-contained box: status, scale metrics,
 * PR/Issue overview and alerts — the same content the overview used to show,
 * now scoped per repository.
 */
function RepoOverviewBox({
  repo,
  live,
}: {
  repo: RepoSummary
  /** Live GitHub counts for this repo, set by the page-level refresh. */
  live?: LiveRepoStats
}) {
  const key = repoKey(repo)
  const base = useMonitorBase(key, FIXED_RANGE)
  const pulls = usePulls(key)
  const issues = useIssues(key)

  if (base.isLoading) {
    return (
      <section className='rounded-xl border bg-card p-4 sm:p-6'>
        <LoadingState />
      </section>
    )
  }

  if (base.isError) {
    return (
      <section className='rounded-xl border bg-card p-4 sm:p-6'>
        <ErrorState onRetry={() => base.meta.refetch()} />
      </section>
    )
  }

  const meta = base.meta.data
  const latest = base.latest.data

  const pullRecords = pulls.data ?? []
  const issueRecords = issues.data ?? []
  const active = activeContributorsSplit(pullRecords, issueRecords, base.range)

  const pullsData = latest?.pulls
  const issuesData = latest?.issues
  const pullComp = compositionParts(pullsData?.composition)
  const issueComp = compositionParts(issuesData?.composition)

  const repoRef = meta?.repo
  const fullName = repoRef?.fullName ?? repo.fullName
  const htmlUrl = repoRef?.htmlUrl ?? repo.htmlUrl
  const defaultBranch = repoRef?.defaultBranch ?? repo.defaultBranch

  return (
    <section className='space-y-4 rounded-xl border bg-card p-4'>
      <header className='flex flex-wrap items-center gap-3'>
        <a
          href={htmlUrl}
          target='_blank'
          rel='noreferrer'
          className='inline-flex items-center gap-2 text-lg font-semibold tracking-tight hover:underline'
        >
          <IconGithub className='size-5' />
          {fullName}
          <Badge variant='outline' className='font-normal'>
            {defaultBranch}
          </Badge>
        </a>
      </header>

      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <MetricCard
          inline
          compact
          title='Stars'
          value={formatNumber(live?.stars ?? latest?.repo.stars)}
          icon={Star}
        />
        <MetricCard
          inline
          compact
          title='Forks'
          value={formatNumber(live?.forks ?? latest?.repo.forks)}
          icon={GitFork}
        />
        <MetricCard
          inline
          compact
          title='累计贡献者'
          value={formatNumber(latest?.contributors.total)}
          icon={Users}
          suffix={`(外部${latest?.contributors.composition.external ?? 0})`}
        />
        <MetricCard
          inline
          compact
          title='活跃贡献者'
          value={formatExact(active.total)}
          icon={Users}
          suffix={`(外部${active.external})`}
          info={<ActiveContributorsInfo />}
        />
      </div>

      <div className='grid gap-3 lg:grid-cols-2'>
        <Card className='gap-2 py-4'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <GitPullRequest className='size-4' />
              Pull Request
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-1'>
            <div className='grid grid-cols-2 gap-x-6'>
              <StatRow label='总数' value={formatNumber(pullsData?.total)} />
              <StatRow
                label='Open'
                value={formatExact(live?.openPulls ?? pullsData?.open)}
              />
            </div>
            <div className='grid grid-cols-2 gap-x-6'>
              <StatRow label='内部' value={pullComp.internal} />
              <StatRow label='外部' value={pullComp.external} />
            </div>
          </CardContent>
        </Card>

        <Card className='gap-2 py-4'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <CircleDot className='size-4' />
              Issue
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-1'>
            <div className='grid grid-cols-2 gap-x-6'>
              <StatRow label='总数' value={formatNumber(issuesData?.total)} />
              <StatRow
                label='Open'
                value={formatExact(live?.openIssues ?? issuesData?.open)}
              />
            </div>
            <div className='grid grid-cols-2 gap-x-6'>
              <StatRow label='内部' value={issueComp.internal} />
              <StatRow label='外部' value={issueComp.external} />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

export function CommunityOverview() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const reposQuery = useRepos()
  const repos = reposQuery.data?.repos ?? []
  const queryClient = useQueryClient()

  const [liveByRepo, setLiveByRepo] = useState<Record<string, LiveRepoStats>>({})
  const [updating, setUpdating] = useState(false)

  // All repositories share a single "data updated at" label: the newest live
  // fetch after a manual refresh, otherwise the published snapshot's build time.
  const liveFetchedAt = Object.values(liveByRepo).reduce<string | null>(
    (latest, stats) =>
      !latest || stats.fetchedAt > latest ? stats.fetchedAt : latest,
    null
  )
  const sharedUpdatedAt =
    liveFetchedAt ?? reposQuery.data?.generatedAt ?? null

  const onSearchChange = (next: typeof search) =>
    navigate({ search: (prev) => ({ ...prev, ...next }) })

  /**
   * Refresh every monitored repository at once: fetch live counts from GitHub
   * for all of them; if GitHub is unreachable, fall back to re-fetching the
   * published snapshots so the button still updates the page.
   */
  const handleUpdateAll = async () => {
    if (repos.length === 0) return
    setUpdating(true)
    try {
      const results = await Promise.allSettled(
        repos.map((repo) => fetchLiveRepoStats(repo))
      )
      const next = { ...liveByRepo }
      let ok = 0
      let firstReason: unknown
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          next[repoKey(repos[index])] = result.value
          ok += 1
        } else if (firstReason === undefined) {
          firstReason = result.reason
        }
      })
      setLiveByRepo(next)

      if (ok === repos.length) {
        toast.success(`已更新全部 ${repos.length} 个仓库的 GitHub 实时数据`)
      } else if (ok > 0) {
        toast.success(`已更新 ${ok}/${repos.length} 个仓库的实时数据，其余失败`)
      } else {
        // GitHub reachable but refused (e.g. rate limit) or unreachable:
        // surface the real reason and still refresh the published snapshots.
        await queryClient.refetchQueries({ queryKey: ['monitor'] })
        const reason =
          firstReason instanceof Error ? firstReason.message : '更新数据失败'
        toast.warning(`${reason}，已刷新为平台已发布的最新快照。`)
      }
    } finally {
      setUpdating(false)
    }
  }

  const updateButton = (
    <div className='flex items-center gap-3'>
      <Button
        size='sm'
        variant='outline'
        className='h-8'
        onClick={handleUpdateAll}
        disabled={updating || repos.length === 0}
      >
        <RefreshCw
          className={cn('size-3.5', updating && 'animate-spin')}
          aria-hidden='true'
        />
        更新数据
      </Button>
      <span className='text-xs text-muted-foreground'>
        数据更新时间 {formatDateTime(sharedUpdatedAt)}
      </span>
    </div>
  )

  const shell = (children: ReactNode) => (
    <>
      <Header>
        <div className='me-auto' />
        <ThemeSwitch />
      </Header>
      <Main className='flex flex-1 flex-col gap-6'>{children}</Main>
    </>
  )

  if (reposQuery.isLoading) {
    return shell(<LoadingState />)
  }

  if (reposQuery.isError) {
    return shell(<ErrorState onRetry={() => reposQuery.refetch()} />)
  }

  return shell(
    <>
      <MonitorHeader
        title='社区概览'
        description='开源社区运营与健康度监控平台，动态展示社区规模、活跃度、健康度与影响力。'
        meta={undefined}
        search={search}
        onSearchChange={onSearchChange}
        showRange={false}
        actions={updateButton}
      />

      {repos.length === 0 ? (
        <ErrorState onRetry={() => reposQuery.refetch()} />
      ) : (
        repos.map((repo) => (
          <RepoOverviewBox
            key={repoKey(repo)}
            repo={repo}
            live={liveByRepo[repoKey(repo)]}
          />
        ))
      )}
    </>
  )
}