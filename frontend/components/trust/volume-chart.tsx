'use client'

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { motion } from 'framer-motion'
import { HOURLY_VOLUME } from '@/lib/data'

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover/95 px-3 py-2 shadow-xl backdrop-blur">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-subtle">{label}</p>
      <p className="font-mono text-xs text-info">
        ₹{payload[0].value.toLocaleString('en-IN')} authorized
      </p>
      {payload[1] && payload[1].value > 0 && (
        <p className="font-mono text-xs text-danger">
          ₹{payload[1].value.toLocaleString('en-IN')} denied
        </p>
      )}
    </div>
  )
}

export function VolumeChart() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="rounded-xl border border-border bg-card/50 p-5"
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Transaction Volume
          </h2>
          <p className="text-xs text-subtle">Authorized vs denied · last 24h</p>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px]">
          <span className="flex items-center gap-1.5 text-info">
            <span className="h-1.5 w-3 rounded-full bg-info" /> authorized
          </span>
          <span className="flex items-center gap-1.5 text-danger">
            <span className="h-1.5 w-3 rounded-full bg-danger" /> denied
          </span>
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={HOURLY_VOLUME} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.65 0.16 250)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="oklch(0.65 0.16 250)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="denyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.65 0.21 22)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="oklch(0.65 0.21 22)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="t"
              stroke="oklch(0.552 0.014 286)"
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
              interval={1}
            />
            <YAxis
              stroke="oklch(0.552 0.014 286)"
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₹${v / 1000}k`}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'oklch(1 0 0 / 10%)' }} />
            <Area
              type="monotone"
              dataKey="volume"
              stroke="oklch(0.65 0.16 250)"
              strokeWidth={2}
              fill="url(#volFill)"
              animationDuration={1200}
            />
            <Area
              type="monotone"
              dataKey="denied"
              stroke="oklch(0.65 0.21 22)"
              strokeWidth={1.5}
              fill="url(#denyFill)"
              animationDuration={1200}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.section>
  )
}
