import { useMemo } from 'react'
import {
  GitPullRequest,
  GitPullRequestArrow,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Timer,
  UsersRound,
} from 'lucide-react'
import { getRouteApi } from '@tanstack/react-router'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FIRST_RESPONSE_BUCKETS,
  bucketValues,
  compositionOf,
  sliceHistory,
} from '@/lib/monitor/derive'
import { usePulls } from '@/lib/monitor/data'
import { formatDurationHours, formatExact, formatNumber } from '@/lib/monitor/format'
import { BreakdownList } from './components/breakdown-list'
import { ChartCard } from './components/chart-card'
import { DataStatusBanner } from './components/data-status-banner'
import { DistributionChart } from './components/distribution-chart'
import { MetricCard } from './components/metric-card'
import { MonitorHeader } from './components/monitor-header'
import { MonitorTable } from './components/monitor-table'
import { ErrorState, LoadingState } from './components/states'
import { TrendChart } from './components/trend-chart'
import { pullsColumns } from './pulls-columns'
import { useMonitorBase } from './use-monitor'

const route = getRouteApi('/_authenticated/pulls')

export function PullsAnalysis() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const base = useMonitorBase(search)
  const pulls = usePulls()

  const records = pulls.data ?? []

  const trend = useMemo(
    () =>
      sliceHistory(base.history, base.range).map((p) => ({
        date: p.date.slice(5),
        newPulls: p.newPulls,
        mergedPulls: p.mergedPulls,
        openPulls: p.openPulls,
      })),
    [base.history, base.range]
  )

  const responseBuckets = useMemo(() => {
    const values = records
      .map((r) => r.firstResponseHours)
      .filter((v): v is number => v !== null)
    return bucketValues(
      values,
      FIRST_RESPONSE_BUCKETS.edges,
      FIRST_RESPONSE_BUCKETS.labels
    )
  }, [records])

  const composition = useMemo(() => compositionOf(records), [records])

  const onSearchChange = (next: typeof search) =>
    navigate({ search: (prev) => ({ ...prev, ...next }) })

  if (base.isLoading) {
    return (
      <>
        <Header>
          <Search className='me-auto' />
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
          <Search className='me-auto' />
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
  const pullsData = latest?.pulls
  const { current, previous } = base

  return (
    <>
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-6'>
        <MonitorHeader
          title='Pull Request 分析'
          description='Pull Request 的贡献流、响应效率与积压情况。'
          meta={base.meta.data}
          search={search}
          onSearchChange={onSearchChange}
        />

        <DataStatusBanner meta={base.meta.data} />

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <MetricCard
            title='新增 PRs'
            value={formatExact(current.newPulls)}
            icon={GitPullRequest}
            delta={current.newPulls}
            previousDelta={previous?.newPulls}
            hint={base.range.label}
          />
          <MetricCard
            title='已合并 PRs'
            value={formatExact(current.mergedPulls)}
            icon={GitPullRequestClosed}
            delta={current.mergedPulls}
            previousDelta={previous?.mergedPulls}
            hint='本周期'
          />
          <MetricCard
            title='Open PRs'
            value={formatExact(pullsData?.open)}
            icon={GitPullRequestArrow}
            delta={current.openPullsDelta}
            previousDelta={previous?.openPullsDelta}
            hint='积压'
          />
          <MetricCard
            title='关闭未合并'
            value={formatExact(current.closedUnmergedPulls)}
            icon={GitPullRequestDraft}
            hint='本周期'
          />
          <MetricCard
            title='首次响应（平均）'
            value={formatDurationHours(pullsData?.firstResponse.avgHours ?? null)}
            icon={Timer}
            hint={`中位 ${formatDurationHours(pullsData?.firstResponse.medianHours ?? null)}`}
            description={`${pullsData?.firstResponse.sampleSize ?? 0} 个已响应的 PR`}
          />
          <MetricCard
            title='合并周期（平均）'
            value={formatDurationHours(pullsData?.mergeCycle.avgHours ?? null)}
            icon={Timer}
            hint={`中位 ${formatDurationHours(pullsData?.mergeCycle.medianHours ?? null)}`}
          />
          <MetricCard
            title='等待回复'
            value={formatExact(pullsData?.awaitingResponse)}
            icon={GitPullRequestDraft}
            hint='尚无回复的 Open PR'
          />
          <MetricCard
            title='超时'
            value={formatExact(pullsData?.overdue.count)}
            icon={GitPullRequestDraft}
            hint={`> ${formatDurationHours(pullsData?.overdue.thresholdHours ?? null)}`}
          />
        </div>

        <div className='grid gap-4 lg:grid-cols-2'>
          <ChartCard
            title='新增 vs 已合并 PRs'
            description='每日新建与合并的 Pull Request。'
            empty={trend.length === 0}
            emptyMessage='暂无历史数据。趋势数据从监控开始日期起累计。'
          >
            <TrendChart
              data={trend}
              xKey='date'
              series={[
                { key: 'newPulls', label: '新增', color: 'var(--chart-1)', type: 'bar' },
                { key: 'mergedPulls', label: '已合并', color: 'var(--chart-2)', type: 'line' },
              ]}
            />
          </ChartCard>

          <ChartCard
            title='Open PR 积压'
            description='Open Pull Request 随时间变化。'
            empty={trend.length === 0}
          >
            <TrendChart
              data={trend}
              xKey='date'
              series={[
                { key: 'openPulls', label: 'Open PRs', color: 'var(--chart-3)', type: 'area' },
              ]}
            />
          </ChartCard>

          <ChartCard
            title='首次响应分布'
            description='从 PR 创建到首次人工响应的时间。'
            empty={records.length === 0}
          >
            <DistributionChart data={responseBuckets} color='var(--chart-4)' />
          </ChartCard>

          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-base'>
                <UsersRound className='size-4' />
                内部 vs 外部贡献
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <BreakdownList composition={composition} />
              <p className='text-xs text-muted-foreground'>
                内部 = 维护者 / 组织成员 / 协作者。无法确认的账号一律标记为
                未知，绝不猜测。
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Pull Request 明细</CardTitle>
          </CardHeader>
          <CardContent>
            <MonitorTable
              data={records}
              columns={pullsColumns}
              searchPlaceholder='按标题、作者或编号搜索 PR…'
              filters={[
                {
                  columnId: 'state',
                  title: '状态',
                  options: [
                    { label: '开启中', value: 'open' },
                    { label: '已合并', value: 'merged' },
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
              emptyMessage='尚未采集到 Pull Request。'
            />
          </CardContent>
        </Card>

        <p className='text-xs text-muted-foreground'>
          数据集中的 PR 总数：{formatNumber(pullsData?.total)}。
        </p>
      </Main>
    </>
  )
}