import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { ExternalLink, Globe, Megaphone } from 'lucide-react'
import { getRouteApi } from '@tanstack/react-router'
import { ConfigDrawer } from '@/components/config-drawer'
import { DataTableColumnHeader } from '@/components/data-table'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useEcosystem, useSelectedRepo } from '@/lib/monitor/data'
import { formatDate, formatExact } from '@/lib/monitor/format'
import { ChartCard } from './components/chart-card'
import { DataStatusBanner } from './components/data-status-banner'
import { MetricCard } from './components/metric-card'
import { MonitorHeader } from './components/monitor-header'
import { MonitorTable } from './components/monitor-table'
import { EmptyState, ErrorState, LoadingState } from './components/states'
import { TrendChart } from './components/trend-chart'
import { useMonitorBase } from './use-monitor'
import type { EcosystemItem } from '@/lib/monitor/types'

const route = getRouteApi('/_authenticated/ecosystem')

const PLANNED_CHANNELS = [
  '视频平台（如 Bilibili、YouTube）',
  '小红书',
  '技术文章 / 博客',
  '外部提及与反向链接',
]

function ecosystemColumns(): ColumnDef<EcosystemItem, unknown>[] {
  return [
    {
      accessorKey: 'platform',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='平台' />
      ),
      cell: ({ row }) => (
        <Badge variant='outline'>{row.original.platform}</Badge>
      ),
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
      meta: { className: 'w-36' },
    },
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='标题' />
      ),
      cell: ({ row }) => (
        <a
          href={row.original.url}
          target='_blank'
          rel='noreferrer'
          className='inline-flex items-center gap-1 hover:underline'
        >
          <span className='line-clamp-1'>{row.original.title}</span>
          <ExternalLink className='size-3.5 shrink-0' />
        </a>
      ),
    },
    {
      accessorKey: 'publishedAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='发布时间' />
      ),
      cell: ({ row }) => (
        <span className='text-nowrap text-xs text-muted-foreground'>
          {formatDate(row.original.publishedAt)}
        </span>
      ),
      meta: { className: 'w-28' },
    },
    {
      id: 'views',
      accessorFn: (row) => row.metrics.views,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='浏览量' />
      ),
      cell: ({ row }) => (
        <span className='tabular-nums'>
          {formatExact(row.original.metrics.views)}
        </span>
      ),
      meta: { className: 'w-24' },
    },
    {
      id: 'engagement',
      header: () => <span>点赞 / 评论 / 分享</span>,
      cell: ({ row }) => (
        <span className='text-nowrap text-xs tabular-nums text-muted-foreground'>
          {formatExact(row.original.metrics.likes)} /{' '}
          {formatExact(row.original.metrics.comments)} /{' '}
          {formatExact(row.original.metrics.shares)}
        </span>
      ),
      enableSorting: false,
      meta: { className: 'w-44' },
    },
    {
      accessorKey: 'source',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='来源' />
      ),
      cell: ({ row }) => (
        <span className='text-xs text-muted-foreground'>
          {row.original.source}
        </span>
      ),
      enableSorting: false,
      meta: { className: 'w-32' },
    },
  ]
}

export function EcosystemInfluence() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const repoList = useSelectedRepo(search)
  const base = useMonitorBase(repoList.key, search)
  const ecosystem = useEcosystem()

  const data = ecosystem.data
  const items = data?.items ?? []
  const available = data?.available ?? false

  const platformSummary = useMemo(() => {
    const map = new Map<string, { platform: string; count: number; views: number }>()
    for (const item of items) {
      const entry =
        map.get(item.platform) ??
        { platform: item.platform, count: 0, views: 0 }
      entry.count += 1
      entry.views += item.metrics.views ?? 0
      map.set(item.platform, entry)
    }
    return [...map.values()].sort((a, b) => b.views - a.views)
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

  const totalViews = items.reduce((a, i) => a + (i.metrics.views ?? 0), 0)
  const totalEngagement = items.reduce(
    (a, i) =>
      a + (i.metrics.likes ?? 0) + (i.metrics.comments ?? 0) + (i.metrics.shares ?? 0),
    0
  )

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
          title='生态影响力'
          description='GitHub 之外的传播与触达。'
          meta={base.meta.data}
          search={search}
          onSearchChange={onSearchChange}
          repos={repoList.repos}
          selectedRepo={repoList.key}
        />

        <DataStatusBanner meta={base.meta.data} />

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <MetricCard
            title='已收录内容'
            value={available ? formatExact(items.length) : '—'}
            icon={Megaphone}
            hint={available ? undefined : '暂无数据来源'}
          />
          <MetricCard
            title='累计浏览量'
            value={available ? formatExact(totalViews) : '—'}
            icon={Globe}
          />
          <MetricCard
            title='互动量'
            value={available ? formatExact(totalEngagement) : '—'}
            icon={Megaphone}
            hint='点赞 + 评论 + 分享'
          />
          <MetricCard
            title='渠道数'
            value={available ? formatExact(platformSummary.length) : '—'}
            icon={Globe}
          />
        </div>

        {!available ? (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Globe className='size-4' />
                外部传播 — 框架就绪，暂无数据
              </CardTitle>
              <CardDescription>
                {data?.note ??
                  '尚未配置外部数据源。'}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <EmptyState
                title='暂无外部内容'
                description='在配置真实数据源之前不会展示任何内容，绝不展示虚构指标。'
              />
              <div className='rounded-lg border p-4'>
                <p className='mb-2 text-sm font-medium'>计划接入的渠道</p>
                <ul className='grid gap-1 text-xs text-muted-foreground sm:grid-cols-2'>
                  {PLANNED_CHANNELS.map((c) => (
                    <li key={c} className='flex items-center gap-2'>
                      <span className='size-1.5 rounded-full bg-muted-foreground/50' />
                      {c}
                    </li>
                  ))}
                </ul>
                <p className='mt-3 text-xs text-muted-foreground'>
                  各项指标按平台分别统计，避免不同平台对“浏览量”定义不一致而混淆。
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className='grid gap-4 lg:grid-cols-2'>
              <ChartCard
                title='各平台触达'
                description='各平台的累计浏览量。'
                empty={platformSummary.length === 0}
              >
                <TrendChart
                  data={platformSummary.map((p) => ({
                    platform: p.platform,
                    views: p.views,
                  }))}
                  xKey='platform'
                  series={[
                    {
                      key: 'views',
                      label: '浏览量',
                      color: 'var(--chart-1)',
                      type: 'bar',
                    },
                  ]}
                />
              </ChartCard>
              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>渠道明细</CardTitle>
                </CardHeader>
                <CardContent className='space-y-2 text-sm'>
                  {platformSummary.map((p) => (
                    <div
                      key={p.platform}
                      className='flex items-center justify-between'
                    >
                      <span className='text-muted-foreground'>
                        {p.platform}
                      </span>
                      <span className='tabular-nums'>
                        {p.count} 条 · {formatExact(p.views)} 次浏览
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>内容明细</CardTitle>
              </CardHeader>
              <CardContent>
                <MonitorTable
                  data={items}
                  columns={ecosystemColumns()}
                  searchPlaceholder='搜索外部内容…'
                  filters={[
                    {
                      columnId: 'platform',
                      title: '平台',
                      options: platformSummary.map((p) => ({
                        label: p.platform,
                        value: p.platform,
                      })),
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </>
        )}
      </Main>
    </>
  )
}