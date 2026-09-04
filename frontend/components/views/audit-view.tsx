'use client'

import { motion } from 'framer-motion'
import { useMemo, useState, useEffect } from 'react'
import { Fingerprint, Lock, ShieldCheck } from 'lucide-react'
import { AUDIT_EVENTS } from '@/lib/data'
import { AuditEventRow } from '@/components/trust/audit-event'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'all', label: 'All events' },
  { key: 'info', label: 'Allowed' },
  { key: 'warn', label: 'Warnings' },
  { key: 'deny', label: 'Denied' },
] as const

export function AuditView() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('all')
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  
  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(data => {
        if (data.audit_trail) {
          // Map backend audit events to frontend format
          const mapped = data.audit_trail.map((e: any) => ({
            id: e.id,
            timestamp: e.date,
            agent: 'gemini-flash',
            action: e.event_type.replace(/_/g, ' ').toUpperCase(),
            resource: e.resource,
            severity: e.details?.decision === 'DENY' || e.event_type.includes('fail') || e.event_type.includes('denied') ? 'deny' : (e.event_type.includes('warn') ? 'warn' : 'info'),
            details: e.details,
            hash: e.id.substring(0, 8) + '...'
          }));
          setLiveEvents(mapped);
        }
      })
      .catch(console.error);
  }, []);

  const events = useMemo(
    () => (tab === 'all' ? liveEvents : liveEvents.filter((e) => e.severity === tab)),
    [tab, liveEvents],
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Audit Trail</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cryptographically verifiable record of Trust Layer decisions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg border border-success/20 bg-success/10 px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-wider text-success">
            <Lock className="h-3 w-3" /> Immutable
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-info/20 bg-info/10 px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-wider text-info">
            <ShieldCheck className="h-3 w-3" /> Hash-chained
          </span>
        </div>
      </div>

      {/* chain root */}
      <div className="flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-card/40 px-5 py-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-info/10 ring-1 ring-inset ring-info/25">
          <Fingerprint className="h-4.5 w-4.5 text-info" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wider text-subtle">
            Ledger root · SHA256
          </p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            7e9cc1332ee6e26f4b0a91d2c7f3e88a1c5d0be6f2a94773cc10ee8842bb0f19
          </p>
        </div>
        <span className="ml-auto hidden shrink-0 font-mono text-[10.5px] text-success md:block">
          {liveEvents.length} sealed entries
        </span>
      </div>

      {/* tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card/50 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'relative rounded-md px-3 py-1 text-xs font-medium transition-colors',
              tab === t.key ? 'text-foreground' : 'text-subtle hover:text-muted-foreground',
            )}
          >
            {tab === t.key && (
              <motion.span
                layoutId="audit-tab"
                className="absolute inset-0 rounded-md bg-white/[0.07] ring-1 ring-inset ring-white/10"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ledger */}
      <div className="rounded-xl border border-border bg-card/40 p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-subtle">
            trust-layer://audit.ledger
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success shadow-[0_0_6px_1px] shadow-success/50" />
            appending
          </span>
        </div>
        <div>
          {events.map((e, i) => (
            <AuditEventRow key={e.id} event={e} index={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
