'use client'

import { motion } from 'framer-motion'
import { ACTIVITY } from '@/lib/data'
import { Dot, type Tone } from './status-badge'
import { cn } from '@/lib/utils'

export function ActivityFeed() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="flex flex-col rounded-xl border border-border bg-card/50"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Live Activity</h2>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-success">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          streaming
        </span>
      </div>
      <ul className="flex-1 divide-y divide-border/60">
        {ACTIVITY.map((a, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.06 }}
            className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-white/[0.02]"
          >
            <Dot tone={a.tone as Tone} />
            <span className="w-16 shrink-0 font-mono text-[10.5px] tabular-nums text-subtle">
              {a.time}
            </span>
            <span
              className={cn(
                'flex-1 truncate font-mono text-[11.5px]',
                a.tone === 'danger' ? 'text-danger' : 'text-foreground/85',
              )}
            >
              {a.event}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {a.amount}
            </span>
            <span className="hidden font-mono text-[10.5px] text-subtle sm:inline">{a.agent}</span>
          </motion.li>
        ))}
      </ul>
    </motion.section>
  )
}
