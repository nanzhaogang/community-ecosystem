import { useMemo } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useIssues, useSelectedRepo } from '@/lib/monitor/data'
import { formatNumber } from '@/lib/monitor/format'
import { ChartCard } from './components/chart-card'
import { MonitorHeader } from './components/monitor-header'
import { MonitorTable } from './components/monitor-table'
import { ErrorState, LoadingState } from './components/states'
import { TimeRangeFilter } from './components/time-range-filter'
import { TrendChart } from './components/trend-chart'
import { issuesColumns } from './issues-columns'
import { useMonitorBase } from './use-monitor'

const route = getRouteApi('/_authenticated/issues')

export function IssuesAnalysis() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const repoList = useSelectedRepo(search)
  const base = useMonitorBase(repoList.key, search)
  const issues = useIssues(repoList.key)

  const records = issues.data ?? []

  // Cumulative Issue count as of each day, counted from the full record set
  // (not the young daily history). Fixed ranges keep their window; "全部历史"
  // spans from the first Issue to today.
  const cumulative = useMemo(() => {
    const { from, to, key } = base.range
    const created = records
      .map((r) => r.createdAt.slice(0, 10))
      .sort((a, b) => a.localeCompare(b))
    const startDay =
      key === 'all' ? created[0] : from?.toISOString().slice(0, 10)
    const endDay = to.toISOString().slice(0, 10)
    if (!startDay || startDay > endDay) return []
    const points: { date: string; total: number }[] = []
    let seen = 0
    const cursor = new Date(`${startDay}T00:00:00.000Z`)
    while (cursor.toISOString().slice(0, 10) <= endDay) {
      const day = cursor.toISOString().slice(0, 10)
      while (seen < created.length && created[seen] <= day) seen += 1
      points.push({ date: day.slice(5), total: seen })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return points
  }, [records, base.range])

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
  const issuesData = latest?.issues

  return (
    <>
      <Header>
        <div className='me-auto' />
        <ThemeSwitch />
      </Header>

      <Main className='flex flex-1 flex-col gap-6'>
        <MonitorHeader
          title='Issue 分析'
          description=''
          meta={base.meta.data}
          search={search}
          onSearchChange={onSearchChange}
          repos={repoList.repos}
          selectedRepo={repoList.key}
          showRange={false}
        />

        <ChartCard
          title='Issue 累计数量'
          description='所选区间内 Issue 累计总数的变化趋势。'
          action={<TimeRangeFilter value={search} onChange={onSearchChange} />}
          empty={cumulative.length === 0}
          emptyMessage='暂无历史数据。'
        >
          <TrendChart
            data={cumulative}
            xKey='date'
            series={[
              {
                key: 'total',
                label: 'Issue 累计',
                color: 'var(--chart-1)',
                type: 'line',
              },
            ]}
            yDomain={['auto', 'auto']}
          />
        </ChartCard>

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

        <p className='text-xs text-muted-foreground'>
          数据集中的 Issue 总数：{formatNumber(issuesData?.total)}。
        </p>
      </Main>
    </>
  )
}