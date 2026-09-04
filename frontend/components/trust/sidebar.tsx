'use client'

import { motion } from 'framer-motion'
import {
  LayoutGrid,
  Receipt,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Database,
  Cable,
  CreditCard,
  Bot,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dot } from './status-badge'

export type View = 'overview' | 'ai-agent' | 'transactions' | 'audit' | 'security'

const NAV: { key: View; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'ai-agent', label: 'AI Sales Agent', icon: Bot },
  { key: 'transactions', label: 'Transactions', icon: Receipt },
  { key: 'audit', label: 'Audit Trail', icon: ScrollText },
  { key: 'security', label: 'Security Lab', icon: ShieldAlert },
]

const SYSTEM = [
  { label: 'Trust Layer', value: 'Operational', icon: ShieldCheck },
  { label: 'API', value: 'Connected', icon: Cable },
  { label: 'Database', value: 'Connected', icon: Database },
  { label: 'Payment Gateway', value: 'Connected', icon: CreditCard },
]

export function Sidebar({
  view,
  onChange,
  onNavigate,
}: {
  view: View
  onChange: (v: View) => void
  onNavigate?: () => void
}) {
  return (
    <div className="flex h-full flex-col gap-2 bg-[oklch(0.135_0.004_285.8)]">
      {/* brand */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-info/30 to-info/5 ring-1 ring-inset ring-info/30">
          <ShieldCheck className="h-4.5 w-4.5 text-info" />
          <span className="absolute inset-0 rounded-lg bg-info/10 blur-md" />
        </div>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold tracking-tight text-foreground">Trust Layer</p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-subtle">agentic commerce</p>
        </div>
      </div>

      {/* nav */}
      <nav className="flex flex-col gap-0.5 px-3">
        <p className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-subtle">
          Console
        </p>
        {NAV.map((item) => {
          const active = view === item.key
          const Icon = item.icon
          return (
            <button
              key={item.key}
              onClick={() => {
                onChange(item.key)
                onNavigate?.()
              }}
              className={cn(
                'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-lg bg-white/[0.06] ring-1 ring-inset ring-white/10"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <Icon
                className={cn(
                  'relative h-4 w-4 transition-colors',
                  active ? 'text-info' : 'text-subtle group-hover:text-muted-foreground',
                )}
              />
              <span className="relative">{item.label}</span>
              {item.key === 'security' && (
                <span className="relative ml-auto rounded bg-danger/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-danger">
                  LIVE
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto px-3 pb-4">
        <div className="rounded-xl border border-border bg-card/40 p-3">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              System Status
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {SYSTEM.map((s) => (
              <li key={s.label} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <s.icon className="h-3.5 w-3.5 text-subtle" />
                  {s.label}
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-success">
                  <Dot tone="success" />
                  {s.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
