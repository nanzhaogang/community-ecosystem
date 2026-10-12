import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatDelta } from '@/lib/monitor/format'

type MetricCardProps = {
  title: string
  value: string
  icon?: LucideIcon
  /** Signed change within the selected period (null = no baseline). */
  delta?: number | null
  /** Signed change within the previous period, for comparison. */
  previousDelta?: number | null
  /** Short context line, e.g. "Open now". */
  hint?: string
  description?: string
  className?: string
}

function DeltaBadge({ delta }: { delta: number | null | undefined }) {
  if (delta === null || delta === undefined) {
    return (
      <span className='inline-flex items-center gap-1 text-muted-foreground'>
        <Minus className='size-3.5' />
        <span>无基线</span>
      </span>
    )
  }
  if (delta === 0) {
    return (
      <span className='inline-flex items-center gap-1 text-muted-foreground'>
        <Minus className='size-3.5' />
        <span>0</span>
      </span>
    )
  }
  const positive = delta > 0
  const Icon = positive ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium',
        positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      )}
    >
      <Icon className='size-3.5' />
      <span>{formatDelta(delta)}</span>
    </span>
  )
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  delta,
  previousDelta,
  hint,
  description,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn('gap-4', className)}>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-0'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        {Icon ? <Icon className='size-4 text-muted-foreground' /> : null}
      </CardHeader>
      <CardContent className='space-y-2'>
        <div className='text-2xl font-bold tabular-nums'>{value}</div>
        <div className='flex flex-wrap items-center gap-x-2 gap-y-1 text-xs'>
          <DeltaBadge delta={delta} />
          {previousDelta !== undefined && previousDelta !== null ? (
            <span className='text-muted-foreground'>
              环比：{formatDelta(previousDelta)}
            </span>
          ) : null}
          {hint ? <span className='text-muted-foreground'>{hint}</span> : null}
        </div>
        {description ? (
          <CardDescription className='text-xs'>{description}</CardDescription>
        ) : null}
      </CardContent>
    </Card>
  )
}