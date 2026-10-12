import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { UserPlus, Users, UsersRound } from 'lucide-react'
import { getRouteApi } from '@tanstack/react-router'
import { ConfigDrawer } from '@/components/config-drawer'
import { DataTableColumnHeader } from '@/components/data-table'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useContributors, useSelectedRepo } from '@/lib/monitor/data'
import { formatDate, formatExact, formatNumber } from '@/lib/monitor/format'
import { BreakdownList } from './components/breakdown-list'
import { DataStatusBanner } from './components/data-status-banner'
import { MetricCard } from './components/metric-card'
import { MonitorHeader } from './components/monitor-header'
import { MonitorTable } from './components/monitor-table'
import { ErrorState, LoadingState } from './components/states'
import { useMonitorBase } from './use-monitor'
import type { ContributorRecord } from '@/lib/monitor/types'

const route = getRouteApi('/_authenticated/contributors')

function contributorsColumns(): ColumnDef<ContributorRecord, unknown>[] {
  return [
    {
      accessorKey: 'login',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='贡献者' />
      ),
      cell: ({ row }) => (
        <span className='text-nowrap font-medium'>
          {row.original.login}
          {row.original.isBot ? (
            <Badge variant='outline' className='ms-2 font-normal'>
              bot
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      accessorKey: 'contributionType',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='类型' />
      ),
      cell: ({ row }) => (
        <Badge variant='outline' className='capitalize'>
          {row.original.contributionType}
        </Badge>
      ),
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
      enableSorting: false,
      meta: { className: 'w-28' },
    },
    {
      accessorKey: 'pulls',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='PRs' />
      ),
      cell: ({ row }) => <span className='tabular-nums'>{row.original.pulls}</span>,
      meta: { className: 'w-20' },
    },
    {
      accessorKey: 'issues',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Issues' />
      ),
      cell: ({ row }) => <span className='tabular-nums'>{row.original.issues}</span>,
      meta: { className: 'w-20' },
    },
    {
      accessorKey: 'reviews',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='评审数' />
      ),
      cell: ({ row }) => (
        <span className='tabular-nums'>{row.original.reviews}</span>
      ),
      meta: { className: 'w-24' },
    },
    {
      accessorKey: 'firstContributionAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='首次' />
      ),
      cell: ({ row }) => (
        <span className='text-nowrap text-xs text-muted-foreground'>
          {formatDate(row.original.firstContributionAt)}
        </span>
      ),
      meta: { className: 'w-28' },
    },
    {
      accessorKey: 'lastContributionAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='最近' />
      ),
      cell: ({ row }) => (
        <span className='text-nowrap text-xs text-muted-foreground'>
          {formatDate(row.original.lastContributionAt)}
        </span>
      ),
      meta: { className: 'w-28' },
    },
  ]
}

export function ContributorsAnalysis() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const repoList = useSelectedRepo(search)
  const base = useMonitorBase(repoList.key, search)
  const contributors = useContributors(repoList.key)

  const items = contributors.data?.items ?? []

  const composition = useMemo(() => {
    const out = { internal: 0, external: 0, unknown: 0 }
    for (const c of items) out[c.contributionType] += 1
    return out
  }, [items])

  const concentration = useMemo(() => {
    const totals = items
      .map((c) => c.pulls + c.issues + c.reviews)
      .sort((a, b) => b - a)
    const total = totals.reduce((a, b) => a + b, 0)
    if (total === 0) return null
    const top10 = totals.slice(0, 10).reduce((a, b) => a + b, 0)
    return top10 / total
  }, [items])

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
  const hasData = items.length > 0

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
          title='贡献者分析'
          description='谁在贡献、贡献频率如何，以及社区贡献的集中度。'
          meta={base.meta.data}
          search={search}
          onSearchChange={onSearchChange}
          repos={repoList.repos}
          selectedRepo={repoList.key}
        />

        <DataStatusBanner meta={base.meta.data} />

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <MetricCard
            title='贡献者总数'
            value={formatNumber(latest?.contributors.total)}
            icon={Users}
            hint='去重账号数'
          />
          <MetricCard
            title='活跃（30 天）'
            value={formatExact(latest?.contributors.activeLast30d)}
            icon={UsersRound}
          />
          <MetricCard
            title='新增（30 天）'
            value={formatExact(latest?.contributors.newLast30d)}
            icon={UserPlus}
          />
          <MetricCard
            title='Top-10 集中度'
            value={concentration === null ? '—' : `${Math.round(concentration * 100)}%`}
            icon={Users}
            hint='占全部贡献的比例'
          />
        </div>

        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>
                内部 vs 外部
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BreakdownList composition={composition} />
              <p className='mt-4 text-xs text-muted-foreground'>
                分类依据可配置的维护者名单与组织成员关系。无法确认的账号会标记为
                “未知”，绝不猜测。
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>
                贡献类型
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-3 text-sm'>
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground'>Pull Requests</span>
                <span className='tabular-nums font-medium'>
                  {formatExact(items.reduce((a, c) => a + c.pulls, 0))}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground'>Issues</span>
                <span className='tabular-nums font-medium'>
                  {formatExact(items.reduce((a, c) => a + c.issues, 0))}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground'>评审</span>
                <span className='tabular-nums font-medium'>
                  {formatExact(items.reduce((a, c) => a + c.reviews, 0))}
                </span>
              </div>
              <p className='pt-2 text-xs text-muted-foreground'>
                贡献者账号与真实用户分开统计（bot 会被标记，而不会并入人工总数）。
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>贡献者明细</CardTitle>
          </CardHeader>
          <CardContent>
            {hasData ? (
              <MonitorTable
                data={items}
                columns={contributorsColumns()}
                initialSorting={[{ id: 'pulls', desc: true }]}
                searchPlaceholder='搜索贡献者…'
                filters={[
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
              />
            ) : (
              <div
                className={cn(
                  'flex min-h-40 flex-col items-center justify-center gap-2 text-center text-muted-foreground'
                )}
              >
                <Users className='size-6' />
                <p className='text-sm font-medium text-foreground'>
                  暂无贡献者数据
                </p>
                <p className='max-w-md text-xs'>
                  本页面是一个可运行的框架。当采集脚本携带 GitHub token
                  运行后，这里将展示每位贡献者的活跃度、首次贡献者与集中度趋势。
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}