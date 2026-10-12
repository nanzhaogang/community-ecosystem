import { DatePicker } from '@/components/date-picker'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  TIME_RANGES,
  TIME_RANGE_LABELS,
  type TimeRangeKey,
  type TimeRangeSearch,
} from '@/lib/monitor/ranges'

type TimeRangeFilterProps = {
  value: TimeRangeSearch
  onChange: (next: TimeRangeSearch) => void
  className?: string
}

function toDate(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const d = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function toDayString(date: Date | undefined): string | undefined {
  if (!date) return undefined
  return date.toISOString().slice(0, 10)
}

export function TimeRangeFilter({
  value,
  onChange,
  className,
}: TimeRangeFilterProps) {
  const range: TimeRangeKey = value.range ?? '30d'

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className='inline-flex flex-wrap items-center gap-1 rounded-lg border p-1'>
        {TIME_RANGES.map((key) => (
          <Button
            key={key}
            type='button'
            size='sm'
            variant={range === key ? 'secondary' : 'ghost'}
            className='h-7 px-2.5 text-xs'
            onClick={() => onChange({ ...value, range: key })}
          >
            {TIME_RANGE_LABELS[key]}
          </Button>
        ))}
      </div>

      {range === 'custom' ? (
        <div className='flex flex-wrap items-center gap-2'>
          <DatePicker
            selected={toDate(value.from)}
            onSelect={(d) => onChange({ ...value, range: 'custom', from: toDayString(d) })}
            placeholder='开始日期'
          />
          <span className='text-muted-foreground'>→</span>
          <DatePicker
            selected={toDate(value.to)}
            onSelect={(d) => onChange({ ...value, range: 'custom', to: toDayString(d) })}
            placeholder='结束日期'
          />
        </div>
      ) : null}
    </div>
  )
}