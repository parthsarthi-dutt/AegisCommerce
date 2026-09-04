'use client'

import { motion } from 'framer-motion'
import { ChevronRight, Search, SlidersHorizontal, Calendar } from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'
import {
  inr,
  type Transaction,
  type TxStatus,
}  from '@/lib/data'
import { StatusBadge } from '@/components/trust/status-badge'
import { AgentBadge } from '@/components/trust/agent-badge'
import { TransactionDetail } from '@/components/trust/transaction-detail'
import { cn } from '@/lib/utils'

const FILTERS: { key: TxStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'captured', label: 'Captured' },
  { key: 'payment_pending', label: 'Pending' },
  { key: 'authorized', label: 'Authorized' },
  { key: 'released', label: 'Released' },
  { key: 'failed', label: 'Failed' },
]

export function TransactionsView() {
  const [filter, setFilter] = useState<TxStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [liveTransactions, setLiveTransactions] = useState<any[]>([]);

  const fetchTransactions = () => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(data => {
        if (data.transactions) {
          // Map backend transaction format to the frontend format
          const mapped = data.transactions.map((t: any) => ({
  id: t.id,
  shortId: t.id.substring(0, 8),

  agent: t.agent || 'Gemini-Flash',
  product: t.product,

  // Backend already returns paise.
  amountPaise: Number(t.amountPaise) || 0,

  policy: t.status === 'failed' ? 'denied' : 'allowed',

  status:
    t.status === 'payment_failed'
      ? 'failed'
      : t.status,

  createdLabel: t.createdAt
    ? new Date(t.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—',

  grantLimitPaise: Number(t.metadata?.grant_snapshot?.max_amount_paise || t.grantLimitPaise) || 0,
  grantConsumedPaise: Number(t.metadata?.grant_snapshot?.amount_consumed || t.grantConsumedPaise) || 0,
  grantReservedPaise: Number(t.metadata?.grant_snapshot?.amount_reserved || t.grantReservedPaise) || 0,
  grantRemainingPaise: Number(
    t.metadata?.grant_snapshot 
      ? (t.metadata.grant_snapshot.max_amount_paise - t.metadata.grant_snapshot.amount_consumed - t.metadata.grant_snapshot.amount_reserved)
      : t.grantRemainingPaise
  ) || 0,

  // The transaction itself is reserved while it is in these states.
  reservedPaise: [
    'authorized',
    'reserved',
    'payment_pending',
  ].includes(t.status)
    ? Number(t.amountPaise) || 0
    : 0,

  policyReason:
    t.failureReason ||
    (t.status === 'failed'
      ? 'Policy violation'
      : 'Allowed by policy engine'),

  catalogVerified: true,
  idempotencyOk: true,

  currency: t.currency || 'INR',

  gatewayOrderId: t.gatewayOrderId || '',
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,

  lifecycle: Array.isArray(t.lifecycle) ? t.lifecycle : [],
}))
          setLiveTransactions(mapped);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const rows = useMemo(() => {
    return liveTransactions.filter((t) => {
      if (filter !== 'all' && t.status !== filter) return false
      if (query) {
        const q = query.toLowerCase()
        return (
          t.shortId.includes(q) ||
          t.agent.toLowerCase().includes(q) ||
          t.product.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [filter, query, liveTransactions])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every AI-initiated financial action passing through the Trust Layer.
        </p>
      </div>

      {/* controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 lg:max-w-xs">
            <Search className="h-3.5 w-3.5 text-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search id, agent, product…"
              className="w-full bg-transparent font-mono text-xs text-foreground placeholder:text-subtle focus:outline-none"
            />
          </div>
          <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Last 24h</span>
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filter</span>
          </button>
        </div>

        <div className="scrollbar-thin flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-card/50 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'relative shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                filter === f.key ? 'text-foreground' : 'text-subtle hover:text-muted-foreground',
              )}
            >
              {filter === f.key && (
                <motion.span
                  layoutId="tx-filter"
                  className="absolute inset-0 rounded-md bg-white/[0.07] ring-1 ring-inset ring-white/10"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card/40">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border text-[10.5px] uppercase tracking-wider text-subtle">
                <th className="px-4 py-3 font-medium">Transaction</th>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Policy</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.03, 0.4) }}
                  onClick={() => setSelected(t)}
                  className="group cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-white/[0.025]"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-foreground/90">{t.shortId}…</span>
                  </td>
                  <td className="px-4 py-3">
                    <AgentBadge id={t.agent} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">{t.product}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-xs font-medium text-foreground">
                      {inr(t.amountPaise)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'font-mono text-[11px] uppercase',
                        t.policy === 'allowed' ? 'text-success/90' : 'text-danger/90',
                      )}
                    >
                      {t.policy === 'allowed' ? 'Allowed' : 'Denied'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} pulse={false} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[11px] text-subtle">{t.createdLabel}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="ml-auto h-4 w-4 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-subtle">
          <span className="font-mono">
            {rows.length} of {liveTransactions.length} transactions
          </span>
          <span className="font-mono">Trust Layer · testnet</span>
        </div>
      </div>

      <TransactionDetail tx={selected} onClose={() => setSelected(null)} onCaptureComplete={fetchTransactions} />
    </div>
  )
}
