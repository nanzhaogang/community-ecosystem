import { useMemo } from 'react'
import {
  Activity,
  ChevronDown,
  CircleAlert,
  CircleCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { formatDurationHours } from '@/lib/monitor/format'
import type {
  MonitorMeta,
  MetricSnapshot,
  PendingItem,
} from '@/lib/monitor/types'
import type { PeriodMetrics } from '@/lib/monitor/derive'

type Severity = 'critical' | 'warning' | 'info' | 'ok'

type AlertItem = {
  id: string
  severity: Severity
  title: string
  description: string
  details?: PendingItem[]
}

type AlertsPanelProps = {
  meta: MonitorMeta | undefined
  latest: MetricSnapshot | undefined
  current: PeriodMetrics | null
  previous: PeriodMetrics | null
}

const SEVERITY_STYLE: Record<Severity, string> = {
  critical: 'border-red-500/40',
  warning: 'border-amber-500/40',
  info: 'border-border',
  ok: 'border-emerald-500/30',
}

function SeverityIcon({ severity }: { severity: Severity }) {
  const cls = cn('size-4 shrink-0', {
    'text-red-600 dark:text-red-400': severity === 'critical',
    'text-amber-600 dark:text-amber-400': severity === 'warning',
    'text-muted-foreground': severity === 'info',
    'text-emerald-600 dark:text-emerald-400': severity === 'ok',
  })
  if (severity === 'ok') return <CircleCheck className={cls} />
  return <CircleAlert className={cls} />
}

export function AlertsPanel({
  meta,
  latest,
  current,
  previous,
}: AlertsPanelProps) {
  const alerts = useMemo<AlertItem[]>(() => {
    const out: AlertItem[] = []
    if (!latest || !meta) return out

    if (meta.status === 'failed') {
      out.push({
        id: 'collection-failed',
        severity: 'critical',
        title: '数据采集失败',
        description:
          '最近一次采集尝试失败。已保留并展示上一次的有效数据集。',
      })
    }

    if (latest.pulls.overdue.count > 0) {
      out.push({
        id: 'overdue-pulls',
        severity: 'critical',
        title: `有 ${latest.pulls.overdue.count} 个 PR 尚未收到首次回复`,
        description: `首次人工回复等待已超过 ${formatDurationHours(
          latest.pulls.overdue.thresholdHours
        )}。`,
        details: latest.pulls.overdue.items,
      })
    }

    if (latest.issues.overdue.count > 0) {
      out.push({
        id: 'overdue-issues',
        severity: 'warning',
        title: `有 ${latest.issues.overdue.count} 个 Issue 尚未收到首次回复`,
        description: `首次人工回复等待已超过 ${formatDurationHours(
          latest.issues.overdue.thresholdHours
        )}。`,
        details: latest.issues.overdue.items,
      })
    }

    if (latest.issues.longOpen.count > 0) {
      out.push({
        id: 'long-open-issues',
        severity: 'warning',
        title: `有 ${latest.issues.longOpen.count} 个 Issue 长期未解决`,
        description: `已开启超过 ${latest.issues.longOpen.thresholdDays} 天。`,
        details: latest.issues.longOpen.items,
      })
    }

    if (current && previous) {
      if (
        current.openPullsDelta !== null &&
        previous.openPullsDelta !== null &&
        current.openPullsDelta > previous.openPullsDelta
      ) {
        out.push({
          id: 'pull-backlog',
          severity: 'warning',
          title: 'Open PR 积压正在增长',
          description: `本周期 Open PR 增加了 ${current.openPullsDelta} 个，上一周期为 ${previous.openPullsDelta} 个。`,
        })
      }
      if (current.newIssues - current.closedIssues > 0) {
        out.push({
          id: 'issue-backlog',
          severity: 'info',
          title: 'Issue 积压有所增加',
          description: `本周期新建 ${current.newIssues} 个、关闭 ${current.closedIssues} 个。`,
        })
      }
    }

    if (out.length === 0) {
      out.push({
        id: 'healthy',
        severity: 'ok',
        title: '暂无告警',
        description:
          '本周期未检测到超时未回复的 PR/Issue、积压增长或采集失败。',
      })
    }

    return out
  }, [latest, meta, current, previous])

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Activity className='size-4' />
          运营告警
        </CardTitle>
        <CardDescription>
          基于当前数据集生成的可解释告警。
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        {alerts.map((alert) => (
          <AlertRow key={alert.id} alert={alert} />
        ))}
      </CardContent>
    </Card>
  )
}

function AlertRow({ alert }: { alert: AlertItem }) {
  const hasDetails = alert.details && alert.details.length > 0
  return (
    <Collapsible
      className={cn('rounded-lg border p-3', SEVERITY_STYLE[alert.severity])}
    >
      <div className='flex items-start gap-3'>
        <SeverityIcon severity={alert.severity} />
        <div className='flex-1 space-y-1'>
          <p className='text-sm font-medium'>{alert.title}</p>
          <p className='text-xs text-muted-foreground'>{alert.description}</p>
        </div>
        {hasDetails ? (
          <CollapsibleTrigger asChild>
            <Button variant='ghost' size='sm' className='h-7 gap-1 text-xs'>
              详情
              <ChevronDown className='size-3.5' />
            </Button>
          </CollapsibleTrigger>
        ) : null}
      </div>
      {hasDetails ? (
        <CollapsibleContent className='mt-3 space-y-1 border-t pt-3'>
          {alert.details!.map((item) => (
            <a
              key={item.number}
              href={item.url}
              target='_blank'
              rel='noreferrer'
              className='flex items-center justify-between gap-2 rounded px-1 py-1 text-xs hover:bg-muted'
            >
              <span className='truncate'>
                <Badge variant='outline' className='me-2 font-mono'>
                  #{item.number}
                </Badge>
                {item.title}
              </span>
              <span className='shrink-0 text-muted-foreground'>
                {formatDurationHours(item.waitingHours)}
              </span>
            </a>
          ))}
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  )
}