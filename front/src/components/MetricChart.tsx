import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MetricName, ReadingRecord } from '../types';
import { formatClockTime } from '../lib/format';
import { METRIC_CONFIG } from '../lib/metrics';
import { DISPLAY_THRESHOLDS } from '../lib/thresholds';

const ACCENT = '#2a78d6';
const GRID = '#e1e0d9';
const MUTED = '#898781';

export function MetricChart({
  readings,
  metric,
}: {
  readings: ReadingRecord[];
  metric: MetricName;
}) {
  const config = METRIC_CONFIG[metric];
  const thresholds = DISPLAY_THRESHOLDS[metric];
  const data = readings.map((r) => ({ ts: r.ts, value: r[metric] }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="ts"
            tickFormatter={formatClockTime}
            stroke={MUTED}
            tick={{ fontSize: 11, fill: MUTED }}
            minTickGap={40}
          />
          <YAxis
            stroke={MUTED}
            tick={{ fontSize: 11, fill: MUTED }}
            width={44}
            label={{
              value: config.unit,
              angle: -90,
              position: 'insideLeft',
              fill: MUTED,
              fontSize: 11,
            }}
          />
          <Tooltip
            formatter={(value: number) => [`${value} ${config.unit}`, config.label]}
            labelFormatter={(ts: string) => new Date(ts).toLocaleString()}
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
          />
          {thresholds && (
            <ReferenceLine
              y={thresholds.warning}
              stroke="#fab219"
              strokeDasharray="4 4"
              label={{
                value: 'warning',
                position: 'insideTopRight',
                fontSize: 10,
                fill: '#fab219',
              }}
            />
          )}
          {thresholds && (
            <ReferenceLine
              y={thresholds.alert}
              stroke="#d03b3b"
              strokeDasharray="4 4"
              label={{ value: 'alert', position: 'insideTopRight', fontSize: 10, fill: '#d03b3b' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={ACCENT}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      {data.length === 0 && (
        <p className="-mt-40 text-center text-sm text-ink-muted">No readings yet for this node.</p>
      )}
    </div>
  );
}
