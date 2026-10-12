import { cn } from '@/lib/utils'
import { formatExact, formatPercent } from '@/lib/monitor/format'
import type { Composition } from '@/lib/monitor/types'

const COLORS: Record<keyof Composition, string> = {
  internal: 'bg-chart-1',
  external: 'bg-chart-2',
  unknown: 'bg-muted-foreground/40',
}

const LABELS: Record<keyof Composition, string> = {
  internal: '内部',
  external: '外部',
  unknown: '未知',
}

type BreakdownListProps = {
  composition: Composition
  className?: string
}

export function BreakdownList({ composition, className }: BreakdownListProps) {
  const total =
    composition.internal + composition.external + composition.unknown
  const order: (keyof Composition)[] = ['internal', 'external', 'unknown']

  return (
    <div className={cn('space-y-3', className)}>
      <div className='flex h-2 w-full overflow-hidden rounded-full bg-muted'>
        {order.map((key) =>
          composition[key] > 0 ? (
            <div
              key={key}
              className={cn('h-full', COLORS[key])}
              style={{ width: `${(composition[key] / total) * 100}%` }}
            />
          ) : null
        )}
      </div>
      <dl className='space-y-2'>
        {order.map((key) => (
          <div key={key} className='flex items-center justify-between text-sm'>
            <dt className='flex items-center gap-2'>
              <span className={cn('size-2.5 rounded-full', COLORS[key])} />
              <span className='text-muted-foreground'>{LABELS[key]}</span>
            </dt>
            <dd className='flex items-center gap-3 tabular-nums'>
              <span className='font-medium'>{formatExact(composition[key])}</span>
              <span className='w-12 text-end text-xs text-muted-foreground'>
                {total > 0 ? formatPercent(composition[key] / total, 0) : '—'}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}