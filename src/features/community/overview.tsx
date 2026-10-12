import { type ReactNode } from 'react'
import {
  CircleDot,
  GitFork,
  GitPullRequest,
  GitPullRequestArrow,
  GitPullRequestClosed,
  Star,
  Users,
} from 'lucide-react'
import { getRouteApi } from '@tanstack/react-router'
import { IconGithub } from '@/assets/brand-icons'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { activeContributorsSplit } from '@/lib/monitor/derive'
import { repoKey, useIssues, usePulls, useRepos } from '@/lib/monitor/data'
import {
  formatDateTime,
  formatDurationHours,
  formatExact,
  formatNumber,
  formatRelative,
} from '@/lib/monitor/format'
import { BreakdownList } from './components/breakdown-list'
import { MetricCard } from './components/metric-card'
import { MonitorHeader } from './components/monitor-header'
import { ErrorState, LoadingState } from './components/states'
import { useMonitorBase } from './use-monitor'
import type { TimeRangeSearch } from '@/lib/monitor/ranges'
import type { RepoSummary } from '@/lib/monitor/types'

const route = getRouteApi('/_authenticated/')

function StatRow({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className='flex items-center justify-between gap-3 py-1.5 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='flex items-baseline gap-2 tabular-nums'>
        <span className='font-medium'>{value}</span>
        {hint ? (
          <span className='text-xs text-muted-foreground'>{hint}</span>
        ) : null}
      </span>
    </div>
  )
}

/**
 * One repository rendered as a self-contained box: status, scale metrics,
 * PR/Issue overview and alerts — the same content the overview used to show,
 * now scoped per repository.
 */
function RepoOverviewBox({
  repo,
  search,
}: {
  repo: RepoSummary
  search: TimeRangeSearch
}) {
  const key = repoKey(repo)
  const base = useMonitorBase(key, search)
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
  const { current } = base
  const lastUpdated = formatRelative(meta?.lastSuccessAt)

  const pullRecords = pulls.data ?? []
  const issueRecords = issues.data ?? []
  const active = activeContributorsSplit(pullRecords, issueRecords, base.range)

  const pullsData = latest?.pulls
  const issuesData = latest?.issues

  const repoRef = meta?.repo
  const fullName = repoRef?.fullName ?? repo.fullName
  const htmlUrl = repoRef?.htmlUrl ?? repo.htmlUrl
  const defaultBranch = repoRef?.defaultBranch ?? repo.defaultBranch
  const description = repoRef?.description ?? repo.description

  return (
    <section className='space-y-6 rounded-xl border bg-card p-4 sm:p-6'>
      <header className='flex flex-wrap items-start justify-between gap-3'>
        <div className='space-y-1'>
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
          {description ? (
            <p className='max-w-2xl text-sm text-muted-foreground'>
              {description}
            </p>
          ) : null}
        </div>
        <div className='shrink-0 text-xs text-muted-foreground'>
          数据更新时间 {formatDateTime(meta?.lastSuccessAt)}
          {lastUpdated ? ` (${lastUpdated})` : null}
        </div>
      </header>

      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <MetricCard
          compact
          title='Stars'
          value={formatNumber(latest?.repo.stars)}
          icon={Star}
        />
        <MetricCard
          compact
          title='Forks'
          value={formatNumber(latest?.repo.forks)}
          icon={GitFork}
        />
        <MetricCard
          compact
          title='贡献者'
          value={formatNumber(latest?.contributors.total)}
          icon={Users}
          suffix={`(外部${latest?.contributors.composition.external ?? 0})`}
        />
        <MetricCard
          compact
          title='活跃贡献者'
          value={formatExact(active.total)}
          icon={Users}
          suffix={`(外部${active.external})`}
        />
        <MetricCard
          compact
          title='PR 总数'
          value={formatNumber(pullsData?.total)}
          icon={GitPullRequest}
        />
        <MetricCard
          compact
          title='Open PRs'
          value={formatExact(pullsData?.open)}
          icon={GitPullRequestArrow}
        />
        <MetricCard
          compact
          title='Issue 总数'
          value={formatNumber(issuesData?.total)}
          icon={CircleDot}
        />
        <MetricCard
          compact
          title='Open Issues'
          value={formatExact(issuesData?.open)}
          icon={CircleDot}
        />
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <GitPullRequestClosed className='size-4' />
              Pull Request 概览
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='divide-y'>
              <StatRow label='总数' value={formatExact(pullsData?.total)} />
              <StatRow label='已合并' value={formatExact(pullsData?.merged)} />
              <StatRow
                label='开启中'
                value={formatExact(pullsData?.open)}
                hint={`本周期新建 ${current.newPulls} / 合并 ${current.mergedPulls}`}
              />
              <StatRow
                label='首次响应（平均 / 中位）'
                value={`${formatDurationHours(pullsData?.firstResponse.avgHours ?? null)} / ${formatDurationHours(pullsData?.firstResponse.medianHours ?? null)}`}
                hint={`n=${pullsData?.firstResponse.sampleSize ?? 0}`}
              />
              <StatRow
                label='合并周期（平均 / 中位）'
                value={`${formatDurationHours(pullsData?.mergeCycle.avgHours ?? null)} / ${formatDurationHours(pullsData?.mergeCycle.medianHours ?? null)}`}
                hint={`n=${pullsData?.mergeCycle.sampleSize ?? 0}`}
              />
            </div>
            <BreakdownList
              composition={
                pullsData?.composition ?? { internal: 0, external: 0, unknown: 0 }
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <CircleDot className='size-4' />
              Issue 概览
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='divide-y'>
              <div className='grid grid-cols-2 gap-x-6'>
                <StatRow label='总数' value={formatExact(issuesData?.total)} />
                <StatRow label='待关闭' value={formatExact(issuesData?.open)} />
              </div>
              <StatRow
                label='首次响应平均'
                value={formatDurationHours(issuesData?.firstResponse.avgHours ?? null)}
                hint={`n=${issuesData?.firstResponse.sampleSize ?? 0}`}
              />
              <StatRow
                label='首次响应中位 / P90'
                value={`${formatDurationHours(issuesData?.firstResponse.medianHours ?? null)} / ${formatDurationHours(issuesData?.firstResponse.p90Hours ?? null)}`}
              />
              <StatRow
                label='关闭周期（平均 / 中位）'
                value={`${formatDurationHours(issuesData?.closeCycle.avgHours ?? null)} / ${formatDurationHours(issuesData?.closeCycle.medianHours ?? null)}`}
                hint={`n=${issuesData?.closeCycle.sampleSize ?? 0}`}
              />
              <StatRow
                label={`长期未解决（>${issuesData?.longOpen.thresholdDays ?? 30} 天）`}
                value={formatExact(issuesData?.longOpen.count)}
              />
            </div>
            <BreakdownList
              composition={
                issuesData?.composition ?? { internal: 0, external: 0, unknown: 0 }
              }
            />
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

  const onSearchChange = (next: typeof search) =>
    navigate({ search: (prev) => ({ ...prev, ...next }) })

  const shell = (children: ReactNode) => (
    <>
      <Header>
        <div className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
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
        description='开源社区运营与健康度监控平台，动态展示社区规模、社区活跃度、社区健康度、社区影响力等情况。'
        meta={undefined}
        search={search}
        onSearchChange={onSearchChange}
      />

      {repos.length === 0 ? (
        <ErrorState onRetry={() => reposQuery.refetch()} />
      ) : (
        repos.map((repo) => (
          <RepoOverviewBox key={repoKey(repo)} repo={repo} search={search} />
        ))
      )}
    </>
  )
}