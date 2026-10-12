import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type ChartDatum = Record<string, string | number | null>

export type ChartSeries = {
  key: string
  label: string
  color: string
  type?: 'line' | 'area' | 'bar'
}

type TrendChartProps = {
  data: ChartDatum[]
  xKey: string
  series: ChartSeries[]
  height?: number
  yFormatter?: (value: number) => string
  xFormatter?: (value: string) => string
  stacked?: boolean
}

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  fontSize: '12px',
  color: 'var(--popover-foreground)',
}

export function TrendChart({
  data,
  xKey,
  series,
  height = 280,
  yFormatter,
  xFormatter,
  stacked,
}: TrendChartProps) {
  return (
    <ResponsiveContainer width='100%' height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke='var(--border)' strokeDasharray='3 3' />
        <XAxis
          dataKey={xKey}
          stroke='var(--muted-foreground)'
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={16}
          tickFormatter={xFormatter}
        />
        <YAxis
          stroke='var(--muted-foreground)'
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={yFormatter}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        {series.map((s) => {
          const common = {
            dataKey: s.key,
            name: s.label,
            stroke: s.color,
            fill: s.color,
          }
          if (s.type === 'bar') {
            return (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                radius={[3, 3, 0, 0]}
                stackId={stacked ? 'stack' : undefined}
                maxBarSize={28}
              />
            )
          }
          if (s.type === 'area') {
            return (
              <Area
                key={s.key}
                {...common}
                type='monotone'
                stackId={stacked ? 'stack' : undefined}
                strokeWidth={2}
                fillOpacity={0.18}
              />
            )
          }
          return (
            <Line
              key={s.key}
              type='monotone'
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          )
        })}
      </ComposedChart>
    </ResponsiveContainer>
  )
}