'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { inr, type LifecycleStage, type Transaction } from '@/lib/data'
import { StatusBadge } from './status-badge'
import { AgentBadge } from './agent-badge'
import { cn } from '@/lib/utils'

const STAGE_ORDER: LifecycleStage[] = [
  'PROPOSED',
  'AUTHORIZED',
  'RESERVED',
  'PAYMENT_PENDING',
  'CAPTURED',
]
function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  const date = new Date(value as string | number)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toISOString().replace('T', ' ').slice(0, 19)
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 py-2.5">
      <span className="text-xs text-subtle">{label}</span>
      <span className="text-right text-xs font-medium text-foreground">{children}</span>
    </div>
  )
}

function Mono({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      className="group inline-flex items-center gap-1.5 font-mono text-xs text-foreground/90 transition-colors hover:text-info"
    >
      {value}
      {copied ? (
        <Check className="h-3 w-3 text-success" />
      ) : (
        <Copy className="h-3 w-3 text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  )
}

function Lifecycle({ tx }: { tx: Transaction }) {
  const failed = tx.status === 'failed'
  const released = tx.status === 'released'
  const stages = failed
    ? (['PROPOSED', 'AUTHORIZED', 'RESERVED', 'PAYMENT_PENDING', 'FAILED'] as LifecycleStage[])
    : released
      ? (['PROPOSED', 'AUTHORIZED', 'RESERVED', 'RELEASED'] as LifecycleStage[])
      : STAGE_ORDER
 const reached = tx.lifecycle ?? []

  return (
    <div className="rounded-lg border border-border bg-white/[0.02] p-4">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-subtle">
        Transaction lifecycle
      </p>
      <ol className="relative ml-1 space-y-0">
        {stages.map((stage, i) => {
          const done = reached.includes(stage)
          const isTerminalBad = stage === 'FAILED' || stage === 'RELEASED'
          const last = i === stages.length - 1
          return (
            <li key={stage} className="relative flex items-start gap-3 pb-4 last:pb-0">
              {!last && (
                <span
                  className={cn(
                    'absolute left-[5px] top-3 h-full w-px',
                    done ? 'bg-success/40' : 'bg-white/10',
                  )}
                />
              )}
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className={cn(
                  'relative z-10 mt-1 h-[11px] w-[11px] shrink-0 rounded-full ring-2',
                  done && isTerminalBad && stage === 'FAILED'
                    ? 'bg-danger ring-danger/30'
                    : done && isTerminalBad
                      ? 'bg-neutral ring-neutral/30'
                      : done
                        ? 'bg-success ring-success/30'
                        : 'bg-white/20 ring-white/10',
                )}
              />
              <div className="-mt-0.5">
                <p
                  className={cn(
                    'font-mono text-[11.5px]',
                    done ? 'text-foreground' : 'text-subtle',
                  )}
                >
                  {stage}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function TransactionDetail({
  tx,
  onClose,
  onCaptureComplete,
}: {
  tx: Transaction | null
  onClose: () => void
  onCaptureComplete?: () => void
}) {
  useEffect(() => {
    if (!tx) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tx, onClose])

  return (
    <AnimatePresence>
      {tx && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            className="scrollbar-thin fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-border bg-[oklch(0.165_0.004_285.8)]"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-[oklch(0.165_0.004_285.8)]/90 px-5 py-4 backdrop-blur">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-subtle">
                  Transaction
                </p>
                <p className="font-mono text-sm text-foreground">{tx.id}</p>
              </div>
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground ring-1 ring-inset ring-border transition-colors hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="flex items-center justify-between">
                <StatusBadge status={tx.status} />
                <span className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                  {inr(tx.amountPaise)}
                </span>
              </div>

              <div>
                <Field label="Transaction ID">
                  <Mono value={tx.id} />
                </Field>
                <Field label="Agent ID">
                  <AgentBadge id={tx.agent} />
                </Field>
                <Field label="Product">{tx.product}</Field>
                <Field label="Amount">
                  <span className="font-mono">{inr(tx.amountPaise)}</span>
                </Field>
                <Field label="Currency">
                  <span className="font-mono">{tx.currency}</span>
                </Field>
              </div>

              <div>
                <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-subtle">
                  Trust evaluation
                </p>
                <Field label="Authorization grant">
                  <span className="font-mono">
                    {inr(tx.grantRemainingPaise)} / {inr(tx.grantLimitPaise)}
                  </span>
                </Field>
                <Field label="Policy decision">
                  <span
                    className={cn(
                      'font-mono uppercase',
                      tx.policy === 'allowed' ? 'text-success' : 'text-danger',
                    )}
                  >
                    {tx.policy}
                  </span>
                </Field>
                <Field label="Policy reason">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {tx.policyReason}
                  </span>
                </Field>
                <Field label="Catalog integrity">
                  <span className={tx.catalogVerified ? 'text-success' : 'text-danger'}>
                    {tx.catalogVerified ? 'verified' : 'mismatch'}
                  </span>
                </Field>
                <Field label="Idempotency">
                  <span className={tx.idempotencyOk ? 'text-success' : 'text-danger'}>
                    {tx.idempotencyOk ? 'no replay' : 'replay blocked'}
                  </span>
                </Field>
                <Field label="Reserved">
                  <span className="font-mono">{inr(tx.reservedPaise)}</span>
                </Field>
              </div>

              <div>
                <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-subtle">
                  Payment
                </p>
                <Field label="Gateway order">
                  {tx.gatewayOrderId ? (
                    <Mono value={tx.gatewayOrderId} />
                  ) : (
                    <span className="font-mono text-subtle">—</span>
                  )}
                </Field>
                <Field label="Payment status">
                  <StatusBadge status={tx.status} pulse={false} />
                </Field>
<Field label="Created at">
  <span className="font-mono text-[11px]">
    {formatDate(tx.createdAt)}
  </span>
</Field>

<Field label="Updated at">
  <span className="font-mono text-[11px]">
    {formatDate(tx.updatedAt)}
  </span>
</Field>
              </div>

              <Lifecycle tx={tx} />

              {( tx.status === 'payment_pending') && (
                <div className="pt-4">
                  <button
                    onClick={() => {
                      if (!tx.gatewayOrderId) {
                        alert("No Gateway Order ID found for this transaction!");
                        return;
                      }
                      
                      const options = {
                        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TVXVHmyhz0YFD6",
                        amount: tx.amountPaise,
                        currency: tx.currency || "INR",
                        name: "Aegis Commerce",
                        description: "Administrative Capture",
                        order_id: tx.gatewayOrderId,
                        handler: async function (response: any) {
                          try {
                            const res = await fetch('/api/capture', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                transaction_id: tx.id,
                                payment_id: response.razorpay_payment_id
                              })
                            });
                            const data = await res.json();
                            if (data.success) {
                              alert('Payment captured successfully!');
                              onClose();
                              onCaptureComplete?.();
                            } else {
                              alert('Capture failed: ' + data.error);
                            }
                          } catch(e: any) {
                            alert('Capture failed: ' + e.message);
                          }
                        },
                        prefill: {
                          name: "Admin",
                          email: "admin@aegis-commerce.com",
                          contact: "9999999999"
                        },
                        theme: { color: "#10b981" }
                      };
                      const rzp = new (window as any).Razorpay(options);
                      rzp.on('payment.failed', function (response: any) {
                          alert("Payment failed: " + response.error.description);
                      });
                      rzp.open();
                    }}
                    className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
                  >
                    Capture Payment
                  </button>
                  <p className="mt-2 text-center text-[10px] text-muted-foreground">
                    Complete the payment for this reserved transaction.
                  </p>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
