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
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  activeContributors,
} from '@/lib/monitor/derive'
import { useIssues, usePulls } from '@/lib/monitor/data'
import {
  formatDurationHours,
  formatExact,
  formatNumber,
} from '@/lib/monitor/format'
import { AlertsPanel } from './components/alerts-panel'
import { BreakdownList } from './components/breakdown-list'
import { DataStatusBanner } from './components/data-status-banner'
import { MetricCard } from './components/metric-card'
import { MonitorHeader } from './components/monitor-header'
import { ErrorState, LoadingState } from './components/states'
import { useMonitorBase } from './use-monitor'

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

export function CommunityOverview() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const base = useMonitorBase(search)
  const pulls = usePulls()
  const issues = useIssues()

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

  const meta = base.meta.data
  const latest = base.latest.data
  const { current, previous } = base

  const pullRecords = pulls.data ?? []
  const issueRecords = issues.data ?? []
  const activeInPeriod = activeContributors(pullRecords, issueRecords, base.range)

  const pullsData = latest?.pulls
  const issuesData = latest?.issues

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
          title='社区概览'
          description='开源社区运营与健康度监控平台，动态展示社区规模、社区活跃度、社区健康度、社区影响力等情况。'
          meta={meta}
          search={search}
          onSearchChange={onSearchChange}
        />

        <DataStatusBanner meta={meta} />

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <MetricCard
            title='Stars'
            value={formatNumber(latest?.repo.stars)}
            icon={Star}
            delta={current.starsDelta}
            previousDelta={previous?.starsDelta}
          />
          <MetricCard
            title='Forks'
            value={formatNumber(latest?.repo.forks)}
            icon={GitFork}
            delta={current.forksDelta}
            previousDelta={previous?.forksDelta}
          />
          <MetricCard
            title='贡献者'
            value={formatNumber(latest?.contributors.total)}
            icon={Users}
            hint={`本周期 ${formatExact(activeInPeriod)} 人活跃`}
            description={`近 30 天新增 ${latest?.contributors.newLast30d ?? 0} 人`}
          />
          <MetricCard
            title='活跃贡献者'
            value={formatExact(activeInPeriod)}
            icon={Users}
            hint={base.range.label}
            description={`近 30 天活跃 ${latest?.contributors.activeLast30d ?? 0} 人`}
          />
          <MetricCard
            title='PR 总数'
            value={formatNumber(pullsData?.total)}
            icon={GitPullRequest}
            delta={current.newPulls}
            previousDelta={previous?.newPulls}
            hint='本周期新增'
          />
          <MetricCard
            title='Open PRs'
            value={formatExact(pullsData?.open)}
            icon={GitPullRequestArrow}
            delta={current.openPullsDelta}
            previousDelta={previous?.openPullsDelta}
          />
          <MetricCard
            title='Issue 总数'
            value={formatNumber(issuesData?.total)}
            icon={CircleDot}
            delta={current.newIssues}
            previousDelta={previous?.newIssues}
            hint='本周期新增'
          />
          <MetricCard
            title='Open Issues'
            value={formatExact(issuesData?.open)}
            icon={CircleDot}
            delta={current.openIssuesDelta}
            previousDelta={previous?.openIssuesDelta}
          />
        </div>

        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-base'>
                <GitPullRequestClosed className='size-4' />
                Pull Request 概览
              </CardTitle>
              <CardDescription>累计与本周期活跃度。</CardDescription>
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
                  label='关闭未合并'
                  value={formatExact(pullsData?.closedUnmerged)}
                />
                <StatRow
                  label='外部最长等待'
                  value={formatDurationHours(pullsData?.externalMaxWaitHours ?? null)}
                  hint='等待回复的外部 PR'
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
                <StatRow
                  label='超时未回复'
                  value={formatExact(pullsData?.overdue.count)}
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
              <CardDescription>累计与本周期活跃度。</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='divide-y'>
                <StatRow label='总数' value={formatExact(issuesData?.total)} />
                <StatRow label='开启中' value={formatExact(issuesData?.open)} />
                <StatRow
                  label='已关闭'
                  value={formatExact(issuesData?.closed)}
                  hint={`本周期新建 ${current.newIssues} / 关闭 ${current.closedIssues}`}
                />
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
                  label='等待回复'
                  value={formatExact(issuesData?.awaitingResponse)}
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

        <AlertsPanel
          meta={meta}
          latest={latest}
          current={current}
          previous={previous}
        />
      </Main>
    </>
  )
}