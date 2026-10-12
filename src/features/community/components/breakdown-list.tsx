import { cn } from '@/lib/utils'
import { formatExact, formatPercent } from '@/lib/monitor/format'
import type { Composition } from '@/lib/monitor/types'

type BreakdownKey = 'internal' | 'external'

const COLORS: Record<BreakdownKey, string> = {
  internal: 'bg-chart-1',
  external: 'bg-chart-2',
}

const LABELS: Record<BreakdownKey, string> = {
  internal: '内部',
  external: '外部',
}

type BreakdownListProps = {
  composition: Composition
  className?: string
}

export function BreakdownList({ composition, className }: BreakdownListProps) {
  // "unknown" is folded into "internal" so the UI only distinguishes
  // internal vs. external contributions.
  const merged: Record<BreakdownKey, number> = {
    internal: composition.internal + composition.unknown,
    external: composition.external,
  }
  const total = merged.internal + merged.external
  const order: BreakdownKey[] = ['internal', 'external']

  return (
    <div className={cn('space-y-2', className)}>
      <div className='flex h-2 w-full overflow-hidden rounded-full bg-muted'>
        {order.map((key) =>
          merged[key] > 0 ? (
            <div
              key={key}
              className={cn('h-full', COLORS[key])}
              style={{ width: `${(merged[key] / total) * 100}%` }}
            />
          ) : null
        )}
      </div>
      <div className='flex items-center justify-between gap-4'>
        {order.map((key) => (
          <div key={key} className='flex items-center gap-2 text-sm'>
            <span className={cn('size-2.5 rounded-full', COLORS[key])} />
            <span className='text-muted-foreground'>{LABELS[key]}</span>
            <span className='font-medium tabular-nums'>
              {formatExact(merged[key])}
            </span>
            <span className='text-xs text-muted-foreground tabular-nums'>
              {total > 0 ? formatPercent(merged[key] / total, 0) : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}