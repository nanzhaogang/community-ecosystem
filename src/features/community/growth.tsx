import { useMemo } from 'react'
import {
  CircleDot,
  GitFork,
  GitPullRequest,
  GitPullRequestClosed,
  Star,
  Users,
} from 'lucide-react'
import { getRouteApi } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { sliceHistory } from '@/lib/monitor/derive'
import { useIssues, usePulls, useSelectedRepo } from '@/lib/monitor/data'
import { formatDurationHours, formatExact, formatNumber } from '@/lib/monitor/format'
import { ChartCard } from './components/chart-card'
import { DataStatusBanner } from './components/data-status-banner'
import { MetricCard } from './components/metric-card'
import { MonitorHeader } from './components/monitor-header'
import { ErrorState, LoadingState } from './components/states'
import { TrendChart } from './components/trend-chart'
import { useMonitorBase } from './use-monitor'
import type { HistoryPoint, IssueRecord, PullRecord } from '@/lib/monitor/types'

const route = getRouteApi('/_authenticated/growth')

function withDeltas(points: HistoryPoint[], key: 'stars' | 'forks') {
  return points.map((p, i) => ({
    date: p.date.slice(5),
    total: p[key],
    added: i > 0 ? p[key] - points[i - 1][key] : 0,
  }))
}

function avgResponseByMonth(
  records: { createdAt: string; firstResponseHours: number | null }[]
): { month: string; avgHours: number }[] {
  const buckets = new Map<string, number[]>()
  for (const r of records) {
    if (r.firstResponseHours === null) continue
    const month = r.createdAt.slice(0, 7)
    const arr = buckets.get(month) ?? []
    arr.push(r.firstResponseHours)
    buckets.set(month, arr)
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, values]) => ({
      month,
      avgHours:
        Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) /
        10,
    }))
}

export function GrowthTrends() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const repoList = useSelectedRepo(search)
  const base = useMonitorBase(repoList.key, search)
  const pulls = usePulls(repoList.key)
  const issues = useIssues(repoList.key)

  const points = useMemo(
    () => sliceHistory(base.history, base.range),
    [base.history, base.range]
  )

  const starSeries = useMemo(() => withDeltas(points, 'stars'), [points])
  const forkSeries = useMemo(() => withDeltas(points, 'forks'), [points])

  const activitySeries = useMemo(
    () =>
      points.map((p) => ({
        date: p.date.slice(5),
        newPulls: p.newPulls,
        mergedPulls: p.mergedPulls,
        newIssues: p.newIssues,
        closedIssues: p.closedIssues,
      })),
    [points]
  )

  const contributorsSeries = useMemo(
    () =>
      points.map((p) => ({
        date: p.date.slice(5),
        activeContributors: p.activeContributors,
      })),
    [points]
  )

  const pullRecords: PullRecord[] = pulls.data ?? []
  const issueRecords: IssueRecord[] = issues.data ?? []
  const pullResponse = useMemo(
    () => avgResponseByMonth(pullRecords),
    [pullRecords]
  )
  const issueResponse = useMemo(
    () => avgResponseByMonth(issueRecords),
    [issueRecords]
  )

  const mergedResponse = useMemo(() => {
    const map = new Map<string, { month: string; pulls?: number; issues?: number }>()
    for (const p of pullResponse) {
      map.set(p.month, { ...(map.get(p.month) ?? { month: p.month }), pulls: p.avgHours })
    }
    for (const i of issueResponse) {
      map.set(i.month, { ...(map.get(i.month) ?? { month: i.month }), issues: i.avgHours })
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
  }, [pullResponse, issueResponse])

  const onSearchChange = (next: typeof search) =>
    navigate({ search: (prev) => ({ ...prev, ...next }) })

  if (repoList.isError) {
    return (
      <>
        <Header>
          <div className='me-auto' />
          <ThemeSwitch />
        </Header>
        <Main>
          <ErrorState onRetry={() => repoList.refetch()} />
        </Main>
      </>
    )
  }

  if (base.isLoading) {
    return (
      <>
        <Header>
          <div className='me-auto' />
          <ThemeSwitch />
        </Header>
        <Main>
          <LoadingState />
        </Main>
      </>
    )
  }

  if (base.isError) {
    return (
      <>
        <Header>
          <div className='me-auto' />
          <ThemeSwitch />
        </Header>
        <Main>
          <ErrorState onRetry={() => base.meta.refetch()} />
        </Main>
      </>
    )
  }

  const latest = base.latest.data
  const { current, previous } = base
  const hasHistory = points.length > 0

  return (
    <>
      <Header>
        <div className='me-auto' />
        <ThemeSwitch />
      </Header>

      <Main className='flex flex-1 flex-col gap-6'>
        <MonitorHeader
          title='社区增长'
          description='随时间变化的增长、开发活跃度与响应效率。'
          meta={base.meta.data}
          search={search}
          onSearchChange={onSearchChange}
          repos={repoList.repos}
          selectedRepo={repoList.key}
        />

        <DataStatusBanner meta={base.meta.data} />

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <MetricCard
            title='新增 Stars'
            value={formatExact(current.starsDelta)}
            icon={Star}
            delta={current.starsDelta}
            previousDelta={previous?.starsDelta}
            hint={base.range.label}
            description={`总数 ${formatNumber(latest?.repo.stars)}`}
          />
          <MetricCard
            title='新增 Forks'
            value={formatExact(current.forksDelta)}
            icon={GitFork}
            delta={current.forksDelta}
            previousDelta={previous?.forksDelta}
            description={`总数 ${formatNumber(latest?.repo.forks)}`}
          />
          <MetricCard
            title='新增 PRs'
            value={formatExact(current.newPulls)}
            icon={GitPullRequest}
            delta={current.newPulls}
            previousDelta={previous?.newPulls}
          />
          <MetricCard
            title='已合并 PRs'
            value={formatExact(current.mergedPulls)}
            icon={GitPullRequestClosed}
            delta={current.mergedPulls}
            previousDelta={previous?.mergedPulls}
          />
          <MetricCard
            title='新增 Issues'
            value={formatExact(current.newIssues)}
            icon={CircleDot}
            delta={current.newIssues}
            previousDelta={previous?.newIssues}
          />
          <MetricCard
            title='已关闭 Issues'
            value={formatExact(current.closedIssues)}
            icon={CircleDot}
            delta={current.closedIssues}
            previousDelta={previous?.closedIssues}
          />
          <MetricCard
            title='活跃贡献者'
            value={formatExact(latest?.contributors.activeLast30d)}
            icon={Users}
            hint='近 30 天'
            description={`总数 ${formatNumber(latest?.contributors.total)}`}
          />
          <MetricCard
            title='历史覆盖'
            value={`${points.length} 天`}
            icon={Users}
            hint={base.range.label}
            description='已记录的每日快照'
          />
        </div>

        {!hasHistory ? (
          <ErrorState
            title='暂无历史数据'
            description='历史趋势从监控开始日期起累计。请运行采集工作流以开始累积每日快照 — 早期历史无法可靠重建。'
          />
        ) : (
          <>
            <section className='space-y-4'>
              <h2 className='text-sm font-semibold tracking-tight text-muted-foreground uppercase'>
                社区增长
              </h2>
              <div className='grid gap-4 lg:grid-cols-2'>
                <ChartCard
                  title='Stars'
                  description='Stars 总数与每日新增。'
                  empty={starSeries.length === 0}
                >
                  <TrendChart
                    data={starSeries}
                    xKey='date'
                    series={[
                      { key: 'total', label: 'Stars 总数', color: 'var(--chart-1)', type: 'line' },
                      { key: 'added', label: '新增', color: 'var(--chart-2)', type: 'bar' },
                    ]}
                  />
                </ChartCard>
                <ChartCard
                  title='Forks'
                  description='Forks 总数与每日新增。'
                  empty={forkSeries.length === 0}
                >
                  <TrendChart
                    data={forkSeries}
                    xKey='date'
                    series={[
                      { key: 'total', label: 'Forks 总数', color: 'var(--chart-3)', type: 'line' },
                      { key: 'added', label: '新增', color: 'var(--chart-4)', type: 'bar' },
                    ]}
                  />
                </ChartCard>
              </div>
            </section>

            <section className='space-y-4'>
              <h2 className='text-sm font-semibold tracking-tight text-muted-foreground uppercase'>
                开发活跃度
              </h2>
              <div className='grid gap-4 lg:grid-cols-2'>
                <ChartCard
                  title='Pull Requests'
                  description='每日新建与合并。'
                  empty={activitySeries.length === 0}
                >
                  <TrendChart
                    data={activitySeries}
                    xKey='date'
                    series={[
                      { key: 'newPulls', label: '新增 PRs', color: 'var(--chart-1)', type: 'bar' },
                      { key: 'mergedPulls', label: '已合并', color: 'var(--chart-2)', type: 'line' },
                    ]}
                  />
                </ChartCard>
                <ChartCard
                  title='Issues'
                  description='每日新建与关闭。'
                  empty={activitySeries.length === 0}
                >
                  <TrendChart
                    data={activitySeries}
                    xKey='date'
                    series={[
                      { key: 'newIssues', label: '新增 Issues', color: 'var(--chart-3)', type: 'bar' },
                      { key: 'closedIssues', label: '已关闭', color: 'var(--chart-4)', type: 'line' },
                    ]}
                  />
                </ChartCard>
                <ChartCard
                  title='活跃贡献者'
                  description='每日活跃的贡献者。'
                  empty={contributorsSeries.length === 0}
                >
                  <TrendChart
                    data={contributorsSeries}
                    xKey='date'
                    series={[
                      { key: 'activeContributors', label: '活跃贡献者', color: 'var(--chart-5)', type: 'area' },
                    ]}
                  />
                </ChartCard>
                <ChartCard
                  title='积压'
                  description='Open PR 与 Issue 随时间变化。'
                  empty={points.length === 0}
                >
                  <TrendChart
                    data={points.map((p) => ({
                      date: p.date.slice(5),
                      openPulls: p.openPulls,
                      openIssues: p.openIssues,
                    }))}
                    xKey='date'
                    series={[
                      { key: 'openPulls', label: 'Open PRs', color: 'var(--chart-1)', type: 'line' },
                      { key: 'openIssues', label: 'Open Issues', color: 'var(--chart-3)', type: 'line' },
                    ]}
                  />
                </ChartCard>
              </div>
            </section>

            <section className='space-y-4'>
              <h2 className='text-sm font-semibold tracking-tight text-muted-foreground uppercase'>
                响应效率
              </h2>
              <div className='grid gap-4 lg:grid-cols-2'>
                <ChartCard
                  title='首次响应时间'
                  description='按月份统计的平均首次响应（小时）。'
                  empty={mergedResponse.length === 0}
                  emptyMessage='暂无响应时间样本。'
                >
                  <TrendChart
                    data={mergedResponse}
                    xKey='month'
                    series={[
                      { key: 'pulls', label: 'PRs', color: 'var(--chart-1)', type: 'line' },
                      { key: 'issues', label: 'Issues', color: 'var(--chart-2)', type: 'line' },
                    ]}
                    yFormatter={(v) => `${v}h`}
                  />
                </ChartCard>
                <ChartCard
                  title='当前响应摘要'
                  description='来自最新快照。'
                  empty={false}
                >
                  <div className='grid grid-cols-2 gap-4 text-sm'>
                    <div className='space-y-1'>
                      <p className='text-muted-foreground'>PR 首次响应</p>
                      <p className='text-lg font-semibold'>
                        {formatDurationHours(latest?.pulls.firstResponse.avgHours ?? null)}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        P90 {formatDurationHours(latest?.pulls.firstResponse.p90Hours ?? null)}
                      </p>
                    </div>
                    <div className='space-y-1'>
                      <p className='text-muted-foreground'>Issue 首次响应</p>
                      <p className='text-lg font-semibold'>
                        {formatDurationHours(latest?.issues.firstResponse.avgHours ?? null)}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        P90 {formatDurationHours(latest?.issues.firstResponse.p90Hours ?? null)}
                      </p>
                    </div>
                    <div className='space-y-1'>
                      <p className='text-muted-foreground'>PR 合并周期</p>
                      <p className='text-lg font-semibold'>
                        {formatDurationHours(latest?.pulls.mergeCycle.avgHours ?? null)}
                      </p>
                    </div>
                    <div className='space-y-1'>
                      <p className='text-muted-foreground'>Issue 关闭周期</p>
                      <p className='text-lg font-semibold'>
                        {formatDurationHours(latest?.issues.closeCycle.avgHours ?? null)}
                      </p>
                    </div>
                  </div>
                </ChartCard>
              </div>
            </section>
          </>
        )}
      </Main>
    </>
  )
}