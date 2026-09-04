'use client'

import { motion } from 'framer-motion'
import { Check, ShieldCheck, Sparkles } from 'lucide-react'
import { inr, type Transaction } from '@/lib/data'
import { AgentBadge } from './agent-badge'

function CheckRow({
  label,
  value,
  delay,
}: {
  label: string
  value: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="flex items-center justify-between border-b border-border/60 py-2.5 last:border-0"
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-mono text-xs text-success">
        <Check className="h-3.5 w-3.5" />
        {value}
      </span>
    </motion.div>
  )
}

export function TrustDecisionCard({ tx }: { tx: Transaction }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-xl border border-border bg-card/50"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-success/10 blur-3xl" />

      <div className="relative flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-info" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Latest Trust Decision
          </h2>
        </div>
        <span className="font-mono text-[10.5px] text-subtle">{tx.createdLabel}</span>
      </div>

      <div className="relative grid gap-5 p-5 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-subtle">
            Agent Request
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-subtle">Agent</span>
              <AgentBadge id={tx.agent} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-subtle">Product</span>
              <span className="text-xs font-medium text-foreground">{tx.product}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-subtle">Amount</span>
              <span className="font-mono text-sm font-semibold text-foreground">
                {inr(tx.amountPaise)}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-white/[0.02] p-3">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="text-subtle">Authorization grant</span>
                <span className="font-mono text-foreground">
                  {inr(tx.grantRemainingPaise)} / {inr(tx.grantLimitPaise)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(tx.amountPaise / tx.grantLimitPaise) * 100}%`,
                  }}
                  transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full bg-gradient-to-r from-info to-success"
                />
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-subtle">
                {inr(tx.amountPaise)} requested · {inr(tx.grantRemainingPaise)} remaining
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-subtle">
            Verification
          </p>
          <div className="flex-1">
            <CheckRow label="Policy evaluation" value="allowed" delay={0.15} />
            <CheckRow label="Catalog integrity" value="verified" delay={0.25} />
            <CheckRow label="Idempotency" value="no replay" delay={0.35} />
            <CheckRow label="Atomic reservation" value={inr(tx.reservedPaise)} delay={0.45} />
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.55, duration: 0.4 }}
            className="mt-3 flex items-center justify-between rounded-lg border border-success/25 bg-success/10 px-4 py-3"
          >
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-success/70">
                Decision
              </p>
              <p className="text-lg font-semibold tracking-tight text-success">AUTHORIZED</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-success/15 ring-1 ring-inset ring-success/30">
              <ShieldCheck className="h-5 w-5 text-success" />
            </div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  )
}
