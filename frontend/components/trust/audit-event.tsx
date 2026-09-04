'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import { ChevronDown, Fingerprint, Link2 } from 'lucide-react'
import type { AuditEvent } from '@/lib/data'
import { JsonBlock } from './terminal-output'
import { AgentBadge } from './agent-badge'
import { cn } from '@/lib/utils'

const SEVERITY: Record<AuditEvent['severity'], { dot: string; text: string }> = {
  info: { dot: 'bg-success shadow-[0_0_6px_1px] shadow-success/50', text: 'text-success' },
  warn: { dot: 'bg-warning shadow-[0_0_6px_1px] shadow-warning/50', text: 'text-warning' },
  deny: { dot: 'bg-danger shadow-[0_0_6px_1px] shadow-danger/50', text: 'text-danger' },
}

export function AuditEventRow({ event, index }: { event: AuditEvent; index: number }) {
  const [open, setOpen] = useState(false)
  const sev = SEVERITY[event.severity]

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.5) }}
      className="relative pl-6"
    >
      {/* rail */}
      <span className="absolute left-[7px] top-0 h-full w-px bg-border" />
      <span className={cn('absolute left-1 top-[15px] h-2.5 w-2.5 rounded-full', sev.dot)} />

      <div className="border-b border-border/50 py-2.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-3 text-left"
        >
          <span className="w-16 shrink-0 font-mono text-[11px] tabular-nums text-subtle">
            {event.time}
          </span>
          <span className={cn('shrink-0 font-mono text-xs font-medium', sev.text)}>
            {event.type}
          </span>
          <span className="hidden items-center gap-1.5 font-mono text-[11px] text-subtle md:flex">
            <Link2 className="h-3 w-3" />
            {event.resource}
          </span>
          <span className="ml-auto hidden md:block">
            <AgentBadge id={event.agent} />
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-subtle transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>

        <motion.div
          initial={false}
          animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <div className="pt-3">
            <JsonBlock data={event.payload} />
            <div className="mt-2 flex items-center gap-1.5 font-mono text-[10.5px] text-subtle">
              <Fingerprint className="h-3 w-3 text-info/70" />
              <span className="text-info/70">SHA256</span>
              <span className="truncate text-muted-foreground/70">{event.hash}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
