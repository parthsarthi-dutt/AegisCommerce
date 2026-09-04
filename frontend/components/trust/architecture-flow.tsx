'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import {
  Bot,
  Scale,
  KeyRound,
  FileCheck,
  Lock,
  CreditCard,
  Webhook,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react'
import { PIPELINE } from '@/lib/data'
import { cn } from '@/lib/utils'

const ICONS = [Bot, Scale, KeyRound, FileCheck, Lock, CreditCard, Webhook, CheckCircle2]

export function ArchitectureFlow() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setActive((a) => (a + 1) % (PIPELINE.length + 2))
    }, 900)
    return () => clearInterval(id)
  }, [])

  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-card/40 p-5">
      <div className="grid-noise pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Trust Execution Pipeline
          </h2>
          <p className="text-xs text-subtle">
            Every AI purchase intent flows through eight verification stages
          </p>
        </div>
        <span className="hidden items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-info sm:flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-info shadow-[0_0_8px_1px] shadow-info/60" />
          Live trace
        </span>
      </div>

      <div className="scrollbar-thin relative flex items-stretch gap-1.5 overflow-x-auto pb-2 lg:gap-0">
        {PIPELINE.map((stage, i) => {
          const Icon = ICONS[i]
          const isActive = active === i
          const passed = active > i
          return (
            <div key={stage.key} className="flex flex-1 items-center">
              <motion.div
                animate={{
                  borderColor: isActive
                    ? 'oklch(0.65 0.16 250 / 0.5)'
                    : 'oklch(1 0 0 / 0.08)',
                }}
                className={cn(
                  'relative flex min-w-[128px] flex-1 flex-col gap-2 rounded-lg border bg-card/60 p-3 lg:min-w-0',
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="pipeline-glow"
                    className="pointer-events-none absolute inset-0 rounded-lg bg-info/10"
                    transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  />
                )}
                <div className="relative flex items-center justify-between">
                  <span
                    className={cn(
                      'grid h-7 w-7 place-items-center rounded-md ring-1 ring-inset transition-colors',
                      isActive
                        ? 'bg-info/15 text-info ring-info/30'
                        : passed
                          ? 'bg-success/10 text-success ring-success/20'
                          : 'bg-white/[0.04] text-subtle ring-white/10',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-mono text-[9px] tabular-nums text-subtle">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="relative">
                  <p className="text-[11.5px] font-semibold leading-tight text-foreground">
                    {stage.label}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-tight text-subtle">{stage.desc}</p>
                </div>
                <div className="relative flex items-center gap-1">
                  <span
                    className={cn(
                      'h-1 w-1 rounded-full',
                      isActive ? 'bg-info' : passed ? 'bg-success' : 'bg-white/15',
                    )}
                  />
                  <span
                    className={cn(
                      'font-mono text-[8.5px] uppercase tracking-wider',
                      isActive ? 'text-info' : passed ? 'text-success' : 'text-subtle',
                    )}
                  >
                    {isActive ? 'processing' : passed ? 'verified' : 'idle'}
                  </span>
                </div>
              </motion.div>
              {i < PIPELINE.length - 1 && (
                <div className="relative flex h-8 w-5 shrink-0 items-center justify-center">
                  <ChevronRight
                    className={cn(
                      'h-3.5 w-3.5 transition-colors',
                      passed ? 'text-success/60' : 'text-white/15',
                    )}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
