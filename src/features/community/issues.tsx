import { useMemo } from 'react'
import {
  CircleDot,
  CircleDashed,
  CircleSlash,
  Timer,
  UsersRound,
} from 'lucide-react'
import { getRouteApi } from '@tanstack/react-router'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  compositionOf,
  issueAgeBuckets,
  sliceHistory,
} from '@/lib/monitor/derive'
import { useIssues, useSelectedRepo } from '@/lib/monitor/data'
import { formatDurationHours, formatExact } from '@/lib/monitor/format'
import { BreakdownList } from './components/breakdown-list'
import { ChartCard } from './components/chart-card'
import { DataStatusBanner } from './components/data-status-banner'
import { DistributionChart } from './components/distribution-chart'
import { MetricCard } from './components/metric-card'
import { MonitorHeader } from './components/monitor-header'
import { MonitorTable } from './components/monitor-table'
import { ErrorState, LoadingState } from './components/states'
import { TrendChart } from './components/trend-chart'
import { issuesColumns } from './issues-columns'
import { useMonitorBase } from './use-monitor'
import type { IssueRecord } from '@/lib/monitor/types'

const route = getRouteApi('/_authenticated/issues')

/** Average first response time grouped by creation month. */
function firstResponseByMonth(
  records: IssueRecord[]
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
        Math.round(
          (values.reduce((a, b) => a + b, 0) / values.length) * 10
        ) / 10,
    }))
}

export function IssuesAnalysis() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const repoList = useSelectedRepo(search)
  const base = useMonitorBase(repoList.key, search)
  const issues = useIssues(repoList.key)

  const records = issues.data ?? []

  const trend = useMemo(
    () =>
      sliceHistory(base.history, base.range).map((p) => ({
        date: p.date.slice(5),
        newIssues: p.newIssues,
        closedIssues: p.closedIssues,
        openIssues: p.openIssues,
      })),
    [base.history, base.range]
  )

  const ageBuckets = useMemo(
    () => issueAgeBuckets(records, base.now),
    [records, base.now]
  )

  const responseTrend = useMemo(
    () => firstResponseByMonth(records),
    [records]
  )

  const composition = useMemo(() => compositionOf(records), [records])

  const onSearchChange = (next: typeof search) =>
    navigate({ search: (prev) => ({ ...prev, ...next }) })

  if (repoList.isError) {
    return (
      <>
        <Header>
          <div className='me-auto' />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
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
          <ConfigDrawer />
          <ProfileDropdown />
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
          <ConfigDrawer />
          <ProfileDropdown />
        </Header>
        <Main>
          <ErrorState onRetry={() => base.meta.refetch()} />
        </Main>
      </>
    )
  }

  const latest = base.latest.data
  const issuesData = latest?.issues
  const { current, previous } = base

  return (
    <>
      <Header>
        <div className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-6'>
        <MonitorHeader
          title='Issue 分析'
          description='Issue 的提交、解决速度与未解决积压。已排除 Pull Request。'
          meta={base.meta.data}
          search={search}
          onSearchChange={onSearchChange}
          repos={repoList.repos}
          selectedRepo={repoList.key}
        />

        <DataStatusBanner meta={base.meta.data} />

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <MetricCard
            title='新增 Issues'
            value={formatExact(current.newIssues)}
            icon={CircleDot}
            delta={current.newIssues}
            previousDelta={previous?.newIssues}
            hint={base.range.label}
          />
          <MetricCard
            title='已关闭 Issues'
            value={formatExact(current.closedIssues)}
            icon={CircleSlash}
            delta={current.closedIssues}
            previousDelta={previous?.closedIssues}
            hint='本周期'
          />
          <MetricCard
            title='Open Issues'
            value={formatExact(issuesData?.open)}
            icon={CircleDashed}
            delta={current.openIssuesDelta}
            previousDelta={previous?.openIssuesDelta}
            hint='积压'
          />
          <MetricCard
            title='等待回复'
            value={formatExact(issuesData?.awaitingResponse)}
            icon={Timer}
            hint='尚无回复的 Open Issue'
          />
          <MetricCard
            title='首次响应平均'
            value={formatDurationHours(issuesData?.firstResponse.avgHours ?? null)}
            icon={Timer}
            description={`中位 ${formatDurationHours(issuesData?.firstResponse.medianHours ?? null)} · P90 ${formatDurationHours(issuesData?.firstResponse.p90Hours ?? null)}`}
          />
          <MetricCard
            title='关闭周期平均'
            value={formatDurationHours(issuesData?.closeCycle.avgHours ?? null)}
            icon={Timer}
            hint={`中位 ${formatDurationHours(issuesData?.closeCycle.medianHours ?? null)}`}
          />
          <MetricCard
            title='超时'
            value={formatExact(issuesData?.overdue.count)}
            icon={CircleDashed}
            hint={`> ${formatDurationHours(issuesData?.overdue.thresholdHours ?? null)}`}
          />
          <MetricCard
            title={`长期未解决（>${issuesData?.longOpen.thresholdDays ?? 30} 天）`}
            value={formatExact(issuesData?.longOpen.count)}
            icon={CircleDashed}
          />
        </div>

        <div className='grid gap-4 lg:grid-cols-2'>
          <ChartCard
            title='新增 vs 已关闭 Issues'
            description='每日新建与关闭的 Issue。'
            empty={trend.length === 0}
            emptyMessage='暂无历史数据。趋势数据从监控开始日期起累计。'
          >
            <TrendChart
              data={trend}
              xKey='date'
              series={[
                { key: 'newIssues', label: '新增', color: 'var(--chart-1)', type: 'bar' },
                { key: 'closedIssues', label: '已关闭', color: 'var(--chart-2)', type: 'line' },
              ]}
            />
          </ChartCard>

          <ChartCard
            title='Open Issue 积压'
            description='Open Issue 随时间变化。'
            empty={trend.length === 0}
          >
            <TrendChart
              data={trend}
              xKey='date'
              series={[
                { key: 'openIssues', label: 'Open Issues', color: 'var(--chart-3)', type: 'area' },
              ]}
            />
          </ChartCard>

          <ChartCard
            title='首次响应趋势'
            description='按创建月份统计的平均首次响应时间。'
            empty={responseTrend.length === 0}
          >
            <TrendChart
              data={responseTrend}
              xKey='month'
              series={[
                { key: 'avgHours', label: '平均小时', color: 'var(--chart-4)', type: 'line' },
              ]}
              yFormatter={(v) => `${v}h`}
            />
          </ChartCard>

          <ChartCard
            title='未解决 Issue 的存续时长'
            description='当前 Open Issue 的存续时长分布。'
            empty={records.length === 0}
          >
            <DistributionChart data={ageBuckets} color='var(--chart-5)' />
          </ChartCard>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <UsersRound className='size-4' />
              内部 vs 外部贡献
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownList composition={composition} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Issue 明细</CardTitle>
          </CardHeader>
          <CardContent>
            <MonitorTable
              data={records}
              columns={issuesColumns}
              searchPlaceholder='按标题、作者或编号搜索 Issue…'
              filters={[
                {
                  columnId: 'state',
                  title: '状态',
                  options: [
                    { label: '开启中', value: 'open' },
                    { label: '已关闭', value: 'closed' },
                  ],
                },
                {
                  columnId: 'contributionType',
                  title: '类型',
                  options: [
                    { label: '内部', value: 'internal' },
                    { label: '外部', value: 'external' },
                    { label: '未知', value: 'unknown' },
                  ],
                },
              ]}
              emptyMessage='尚未采集到 Issue。'
            />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}