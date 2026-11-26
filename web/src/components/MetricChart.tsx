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

const ACCENT = 'var(--accent)';
const GRID = 'var(--line)';
const MUTED = 'var(--muted)';

export function MetricChart({
  readings = [],
  metric,
  thresholds,
  points,
  showDates = false,
}: {
  readings?: ReadingRecord[];
  metric: MetricName;
  thresholds?: { warning: number; alert: number };
  points?: { ts: string; value: number | null }[];
  showDates?: boolean;
}) {
  const config = METRIC_CONFIG[metric];
  const data = points ?? readings.map((r) => ({ ts: r.ts, value: r[metric] }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="ts"
            tickFormatter={
              showDates
                ? (ts: string) =>
                    new Date(ts).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                : formatClockTime
            }
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
              stroke="var(--warning)"
              strokeDasharray="4 4"
              label={{
                value: 'warning',
                position: 'insideTopRight',
                fontSize: 10,
                fill: 'var(--warning)',
              }}
            />
          )}
          {thresholds && (
            <ReferenceLine
              y={thresholds.alert}
              stroke="var(--critical)"
              strokeDasharray="4 4"
              label={{
                value: 'alert',
                position: 'insideTopRight',
                fontSize: 10,
                fill: 'var(--critical)',
              }}
            />
          )}
          <Line
            type="linear"
            dataKey="value"
            stroke={ACCENT}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
      {(data.length === 0 || data.every((point) => point.value == null)) && (
        <p className="-mt-40 text-center text-sm text-ink-muted">No readings yet for this node.</p>
      )}
    </div>
  );
}
