'use client'

import { motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock3,
  KeyRound,
  Lock,
  ShieldCheck,
  ShieldX,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { ArchitectureFlow } from '@/components/trust/architecture-flow'
import { cn } from '@/lib/utils'

interface DashboardMetrics {
  total_revenue_paise: number
  funds_reserved_paise: number
  policy_denials: number
  active_grants: number
}

interface DashboardTransaction {
  id: string
  product: string
  amountPaise: number
  currency: string
  agent: string
  status: string
  date: string
  createdAt: string
  updatedAt: string
  gatewayOrderId: string
  failureReason: string
  metadata?: Record<string, unknown>
  grantLimitPaise: number
  grantConsumedPaise: number
  grantReservedPaise: number
  grantRemainingPaise: number
  lifecycle: string[]
}

interface AuditEvent {
  id: string
  event_type: string
  resource: string
  details?: Record<string, unknown>
  date: string
}

interface DashboardData {
  metrics: DashboardMetrics
  transactions: DashboardTransaction[]
  audit_trail: AuditEvent[]
}

const EMPTY_DATA: DashboardData = {
  metrics: {
    total_revenue_paise: 0,
    funds_reserved_paise: 0,
    policy_denials: 0,
    active_grants: 0,
  },
  transactions: [],
  audit_trail: [],
}

function formatINR(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format((Number(paise) || 0) / 100)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN').format(value)
}

function shortId(id: string) {
  return id ? `${id.slice(0, 8)}…` : '—'
}

function formatTime(date?: string) {
  if (!date) return '—'

  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) {
    return '—'
  }

  return parsed.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(date?: string) {
  if (!date) return '—'

  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) {
    return '—'
  }

  return parsed.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
  })
}

function isSuccessful(status: string) {
  return [
    'authorized',
    'reserved',
    'payment_pending',
    'captured',
  ].includes(status)
}

function isFailed(status: string) {
  return [
    'failed',
    'payment_failed',
    'cancelled',
    'expired',
    'released',
  ].includes(status)
}

export function OverviewView({
  onNavigate,
}: {
  onNavigate: (view: 'transactions') => void
}) {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = async () => {
    try {
      setError(null)

      const response = await fetch('/api/dashboard', {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`Dashboard request failed: HTTP ${response.status}`)
      }

      const json = await response.json()

      setData({
        metrics: {
          total_revenue_paise:
            Number(json?.metrics?.total_revenue_paise) || 0,
          funds_reserved_paise:
            Number(json?.metrics?.funds_reserved_paise) || 0,
          policy_denials:
            Number(json?.metrics?.policy_denials) || 0,
          active_grants:
            Number(json?.metrics?.active_grants) || 0,
        },

        transactions: Array.isArray(json?.transactions)
          ? json.transactions
          : [],

        audit_trail: Array.isArray(json?.audit_trail)
          ? json.audit_trail
          : [],
      })
    } catch (err) {
      console.error('[DASHBOARD]', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load dashboard data',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()

    // Refresh dashboard periodically so the UI reflects
    // transactions created from the rest of the application.
    const interval = window.setInterval(fetchDashboard, 10000)

    return () => window.clearInterval(interval)
  }, [])

  const transactions = data.transactions

  /*
   * --------------------------------------------------
   * REAL DERIVED METRICS
   * --------------------------------------------------
   */

  const threats = useMemo(() => {
    const result = {
      authorization: 0,
      policy: 0,
      catalog: 0,
      idempotency: 0,
      limit: 0,
      other: 0,
    }

    for (const event of data.audit_trail) {
      const type = `${event.event_type} ${
        event.resource || ''
      }`.toLowerCase()

      const metadata = JSON.stringify(
        event.details || {},
      ).toLowerCase()

      const text = `${type} ${metadata}`

      const isDenied = 
        event.details?.decision === 'DENY' || 
        type.includes('fail') || 
        type.includes('denied') ||
        type.includes('unauthorized') ||
        type.includes('invalid') ||
        type.includes('blocked') ||
        type.includes('prevented');

      if (!isDenied) continue;

      if (
        text.includes('limit') ||
        text.includes('spending')
      ) {
        result.limit++
      } else if (
        text.includes('policy') ||
        type.includes('policy_evaluation')
      ) {
        result.policy++
      } else if (
        text.includes('authorization') ||
        text.includes('unauthorized') ||
        text.includes('grant')
      ) {
        result.authorization++
      } else if (
        text.includes('catalog') ||
        text.includes('integrity')
      ) {
        result.catalog++
      } else if (
        text.includes('idempot') ||
        text.includes('replay')
      ) {
        result.idempotency++
      } else {
        result.other++
      }
    }

    return [
      {
        label: 'Authorization',
        value: result.authorization,
      },
      {
        label: 'Policy',
        value: result.policy,
      },
      {
        label: 'Catalog integrity',
        value: result.catalog,
      },
      {
        label: 'Replay / idempotency',
        value: result.idempotency,
      },
      {
        label: 'Spending limit',
        value: result.limit,
      },
    ]
  }, [data.audit_trail])

  const totalThreatDenials = useMemo(() => {
    return threats.reduce((sum, item) => sum + item.value, 0)
  }, [threats])

  const transactionStats = useMemo(() => {
    const total = transactions.length

    const successful = transactions.filter((t) =>
      isSuccessful(t.status),
    ).length

    const failed = totalThreatDenials

    const pending = transactions.filter(
      (t) =>
        t.status === 'created' ||
        t.status === 'payment_pending',
    ).length

    const approvalRate =
      total > 0 ? Math.round((successful / total) * 100) : 0

    return {
      total: successful + pending + failed,
      successful,
      failed,
      pending,
      approvalRate,
    }
  }, [transactions, totalThreatDenials])

  /*
   * --------------------------------------------------
   * TRANSACTION TIMELINE
   * --------------------------------------------------
   */

  const timeline = useMemo(() => {
    const buckets = new Map<
      string,
      {
        label: string
        total: number
        successful: number
        failed: number
      }
    >()

    const now = new Date()

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now)
      date.setHours(now.getHours() - i)

      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`

      buckets.set(key, {
        label: date.toLocaleTimeString('en-US', {
          hour: 'numeric',
        }).toUpperCase(),
        total: 0,
        successful: 0,
        failed: 0,
      })
    }

    for (const transaction of transactions) {
      const date = new Date(transaction.createdAt)

      if (Number.isNaN(date.getTime())) continue

      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`

      const bucket = buckets.get(key)

      if (!bucket) continue

      bucket.total += 1

      if (isSuccessful(transaction.status)) {
        bucket.successful += 1
      }

      if (isFailed(transaction.status)) {
        bucket.failed += 1
      }
    }

    return Array.from(buckets.values())
  }, [transactions])

  /*
   * --------------------------------------------------
   * GRANT UTILIZATION
   * --------------------------------------------------
   */

  const grant = useMemo(() => {
    const transactionWithGrant = transactions.find(
      (t) => t.grantLimitPaise > 0,
    )

    if (!transactionWithGrant) {
      return {
        limit: 0,
        consumed: data.metrics.total_revenue_paise,
        reserved: data.metrics.funds_reserved_paise,
        remaining: 0,
        usedPercent: 0,
      }
    }

    const limit = transactionWithGrant.grantLimitPaise
    const consumed = transactionWithGrant.grantConsumedPaise
    const reserved = transactionWithGrant.grantReservedPaise
    const remaining = Math.max(
      0,
      limit - consumed - reserved,
    )

    const committed = consumed + reserved

    return {
      limit,
      consumed,
      reserved,
      remaining,
      usedPercent:
        limit > 0
          ? Math.min(100, Math.round((committed / limit) * 100))
          : 0,
    }
  }, [transactions, data.metrics])

  /*
   * --------------------------------------------------
   * STATUS DISTRIBUTION
   * --------------------------------------------------
   */

  const statusDistribution = useMemo(() => {
    const captured = transactions.filter(
      (t) => t.status === 'captured',
    ).length

    const pending = transactions.filter(
      (t) =>
        t.status === 'payment_pending' ||
        t.status === 'created',
    ).length

    const authorized = transactions.filter(
      (t) =>
        t.status === 'authorized' ||
        t.status === 'reserved',
    ).length

    const failed = totalThreatDenials

    return {
      captured,
      pending,
      authorized,
      failed,
    }
  }, [transactions, totalThreatDenials])

  const maxTimelineValue = Math.max(
    1,
    ...timeline.map((item) => item.total),
  )

  const maxThreatValue = Math.max(
    1,
    ...threats.map((item) => item.value),
  )

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------ */}
      {/* HERO */}
      {/* ------------------------------------------------ */}

      <Hero
        onNavigate={onNavigate}
        activeGrants={data.metrics.active_grants}
        loading={loading}
      />

      {/* ------------------------------------------------ */}
      {/* ERROR */}
      {/* ------------------------------------------------ */}

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />

          <div>
            <p className="font-medium">
              Dashboard data unavailable
            </p>
            <p className="mt-0.5 text-xs opacity-80">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ */}
      {/* KPI ROW */}
      {/* ------------------------------------------------ */}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Metric
          label="Consumed Volume"
          value={formatINR(
            data.metrics.total_revenue_paise,
          )}
          description="Funds consumed"
          icon={Banknote}
          tone="success"
        />

        <Metric
          label="Reserved Funds"
          value={formatINR(
            data.metrics.funds_reserved_paise,
          )}
          description="Currently locked"
          icon={Lock}
          tone="warning"
        />

        <Metric
          label="Policy Denials"
          value={formatNumber(totalThreatDenials)}
          description="Requests blocked"
          icon={ShieldX}
          tone="danger"
        />

        <Metric
          label="Active Grants"
          value={formatNumber(
            data.metrics.active_grants,
          )}
          description="Currently authorized"
          icon={KeyRound}
          tone="info"
        />
      </div>

      {/* ------------------------------------------------ */}
      {/* ARCHITECTURE */}
      {/* ------------------------------------------------ */}

      <ArchitectureFlow />

      {/* ------------------------------------------------ */}
      {/* MAIN ANALYTICS */}
      {/* ------------------------------------------------ */}

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <TransactionActivity
          timeline={timeline}
          maxValue={maxTimelineValue}
        />

        <OutcomeCard
          stats={transactionStats}
          distribution={statusDistribution}
        />
      </div>

      {/* ------------------------------------------------ */}
      {/* GRANT + THREATS */}
      {/* ------------------------------------------------ */}

      <div className="grid gap-4 lg:grid-cols-2">
        <GrantUtilization grant={grant} />

        <ThreatBreakdown
          threats={threats}
          maxValue={maxThreatValue}
          totalDenials={totalThreatDenials}
        />
      </div>

      {/* ------------------------------------------------ */}
      {/* RECENT ACTIVITY */}
      {/* ------------------------------------------------ */}

      <RecentActivity
        transactions={transactions}
        auditTrail={data.audit_trail}
      />
    </div>
  )
}

/*
 * ======================================================
 * HERO
 * ======================================================
 */

function Hero({
  onNavigate,
  activeGrants,
  loading,
}: {
  onNavigate: (view: 'transactions') => void
  activeGrants: number
  loading: boolean
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card/40 px-6 py-8 md:px-8 md:py-10"
    >
      <div className="grid-noise pointer-events-none absolute inset-0 opacity-50" />

      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-info/10 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-32 right-10 h-72 w-72 rounded-full bg-success/[0.07] blur-3xl" />

      <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-3 py-1 font-mono text-[10.5px] font-medium uppercase tracking-wider text-success">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>

            Trust Layer Operational
          </span>

          <h1 className="mt-4 text-balance text-3xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-[2.6rem]">
            Financial Trust Infrastructure
            <br />

            <span className="text-muted-foreground">
              for Autonomous AI
            </span>
          </h1>

          <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
            Authorize, control and settle AI-initiated
            financial transactions. The Trust Layer verifies
            authorization, evaluates policy, validates
            catalog integrity and reserves funds before money
            moves.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigate('transactions')}
              className="group inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              View live transactions

              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              onClick={() =>
                document
                  .getElementById('architecture')
                  ?.scrollIntoView({
                    behavior: 'smooth',
                  })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white/[0.03] px-3.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Read architecture
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 lg:gap-4">
          <HeroStat
            value={
              loading
                ? '—'
                : `${transactionStatusPercentage(activeGrants)}%`
            }
            label="Trust coverage"
          />

          <HeroStat
            value={
              loading ? '—' : String(activeGrants)
            }
            label="Active grants"
          />

          <HeroStat
            value={loading ? '—' : 'LIVE'}
            label="Data source"
          />
        </div>
      </div>
    </motion.section>
  )
}

function transactionStatusPercentage(
  activeGrants: number,
) {
  // This is deliberately not presented as a fake
  // transaction approval rate. It represents whether
  // there is an active authorization layer available.
  return activeGrants > 0 ? 100 : 0
}

function HeroStat({
  value,
  label,
}: {
  value: string
  label: string
}) {
  return (
    <div className="rounded-xl border border-border bg-white/[0.02] px-4 py-3 text-center">
      <p className="font-mono text-lg font-semibold tracking-tight text-foreground">
        {value}
      </p>

      <p className="mt-0.5 text-[10.5px] uppercase tracking-wide text-subtle">
        {label}
      </p>
    </div>
  )
}

/*
 * ======================================================
 * METRIC
 * ======================================================
 */

function Metric({
  label,
  value,
  description,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  description: string
  icon: typeof Banknote
  tone: 'success' | 'warning' | 'danger' | 'info'
}) {
  const toneClasses = {
    success:
      'bg-success/10 text-success ring-success/20',
    warning:
      'bg-warning/10 text-warning ring-warning/20',
    danger:
      'bg-danger/10 text-danger ring-danger/20',
    info:
      'bg-info/10 text-info ring-info/20',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card/40 p-4"
    >
      <div className="flex items-start justify-between">
        <span
          className={cn(
            'grid h-8 w-8 place-items-center rounded-lg ring-1 ring-inset',
            toneClasses[tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </span>

        <Activity className="h-3.5 w-3.5 text-subtle" />
      </div>

      <p className="mt-4 text-[10px] font-medium uppercase tracking-wider text-subtle">
        {label}
      </p>

      <p className="mt-1 font-mono text-xl font-semibold tracking-tight text-foreground">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-muted-foreground">
        {description}
      </p>
    </motion.div>
  )
}

/*
 * ======================================================
 * TRANSACTION ACTIVITY GRAPH
 * ======================================================
 */

function TransactionActivity({
  timeline,
  maxValue,
}: {
  timeline: {
    label: string
    total: number
    successful: number
    failed: number
  }[]
  maxValue: number
}) {
  const width = 760
  const height = 250
  const paddingX = 36
  const paddingTop = 25
  const paddingBottom = 35

  const chartWidth = width - paddingX * 2
  const chartHeight =
    height - paddingTop - paddingBottom

  const points = timeline.map((item, index) => {
    const x =
      paddingX +
      (index /
        Math.max(1, timeline.length - 1)) *
        chartWidth

    const y =
      paddingTop +
      chartHeight -
      (item.total / maxValue) * chartHeight

    return {
      x,
      y,
      item,
    }
  })

  const linePath = points
    .map((point, index) =>
      `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`,
    )
    .join(' ')

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-subtle">
            Transaction activity
          </p>

          <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
            Live authorization activity
          </h2>

          <p className="mt-1 text-xs text-muted-foreground">
            Real transactions received by the Trust Layer.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white/[0.02] px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Real data
        </span>
      </div>

      <div className="mt-6 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[260px] w-full"
          preserveAspectRatio="none"
        >
          {[0, 1, 2, 3].map((line) => {
            const y =
              paddingTop +
              (chartHeight / 3) * line

            return (
              <line
                key={line}
                x1={paddingX}
                x2={width - paddingX}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-border/60"
                strokeDasharray="4 7"
              />
            )
          })}

          <path
            d={linePath}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-success"
          />

          {points.map((point, index) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                className="fill-success"
              />

              <circle
                cx={point.x}
                cy={point.y}
                r="9"
                className="fill-success/10"
              />

              <text
                x={point.x}
                y={height - 10}
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-[10px]"
              >
                {point.item.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-1 flex items-center gap-5 border-t border-border pt-3 text-[10px] text-subtle">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Requests
        </span>

        <span>
          Last 6 hours
        </span>
      </div>
    </section>
  )
}

/*
 * ======================================================
 * OUTCOME CARD
 * ======================================================
 */

function OutcomeCard({
  stats,
  distribution,
}: {
  stats: {
    total: number
    successful: number
    failed: number
    pending: number
    approvalRate: number
  }
  distribution: {
    captured: number
    pending: number
    authorized: number
    failed: number
  }
}) {
  const total = Math.max(
    1,
    distribution.captured +
      distribution.pending +
      distribution.authorized +
      distribution.failed,
  )

  const capturedPercent =
    (distribution.captured / total) * 100

  const pendingPercent =
    (distribution.pending / total) * 100

  const authorizedPercent =
    (distribution.authorized / total) * 100

  const failedPercent =
    (distribution.failed / total) * 100

  const gradient = `conic-gradient(
    var(--success) 0 ${capturedPercent}%,
    var(--warning) ${capturedPercent}% ${
      capturedPercent + pendingPercent
    }%,
    var(--info) ${
      capturedPercent + pendingPercent
    }% ${
      capturedPercent +
      pendingPercent +
      authorizedPercent
    }%,
    var(--danger) ${
      capturedPercent +
      pendingPercent +
      authorizedPercent
    }% 100%
  )`

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5">
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-subtle">
          Trust outcomes
        </p>

        <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
          Request disposition
        </h2>

        <p className="mt-1 text-xs text-muted-foreground">
          Current transaction state across the Trust Layer.
        </p>
      </div>

      <div className="mt-7 flex items-center gap-7">
        <div className="relative h-36 w-36 shrink-0">
          <div
            className="h-full w-full rounded-full"
            style={{
              background: gradient,
            }}
          />

          <div className="absolute inset-[18px] grid place-items-center rounded-full bg-card">
            <div className="text-center">
              <p className="font-mono text-2xl font-semibold text-foreground">
                {stats.total}
              </p>

              <p className="font-mono text-[8px] uppercase tracking-wider text-subtle">
                requests
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <OutcomeRow
            label="Captured"
            value={distribution.captured}
            total={total}
            tone="success"
          />

          <OutcomeRow
            label="Pending"
            value={distribution.pending}
            total={total}
            tone="warning"
          />

          <OutcomeRow
            label="Authorized"
            value={distribution.authorized}
            total={total}
            tone="info"
          />

          <OutcomeRow
            label="Failed / denied"
            value={distribution.failed}
            total={total}
            tone="danger"
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-white/[0.02] p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-subtle">
            Approval rate
          </p>

          <p className="mt-1 font-mono text-lg font-semibold text-success">
            {stats.approvalRate}%
          </p>
        </div>

        <div className="rounded-lg border border-border bg-white/[0.02] p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-subtle">
            Failed
          </p>

          <p className="mt-1 font-mono text-lg font-semibold text-danger">
            {stats.failed}
          </p>
        </div>
      </div>
    </section>
  )
}

function OutcomeRow({
  label,
  value,
  total,
  tone,
}: {
  label: string
  value: number
  total: number
  tone: 'success' | 'warning' | 'info' | 'danger'
}) {
  const colors = {
    success: 'bg-success',
    warning: 'bg-warning',
    info: 'bg-info',
    danger: 'bg-danger',
  }

  const percentage =
    Math.round((value / total) * 100)

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              colors[tone],
            )}
          />

          {label}
        </span>

        <span className="font-mono text-[10px] text-foreground">
          {value}
        </span>
      </div>

      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className={cn(
            'h-full rounded-full',
            colors[tone],
          )}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  )
}

/*
 * ======================================================
 * GRANT UTILIZATION
 * ======================================================
 */

function GrantUtilization({
  grant,
}: {
  grant: {
    limit: number
    consumed: number
    reserved: number
    remaining: number
    usedPercent: number
  }
}) {
  const consumedPercent =
    grant.limit > 0
      ? Math.min(
          100,
          (grant.consumed / grant.limit) * 100,
        )
      : 0

  const reservedPercent =
    grant.limit > 0
      ? Math.min(
          100,
          (grant.reserved / grant.limit) * 100,
        )
      : 0

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-subtle">
            Authorization budget
          </p>

          <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
            Grant utilization
          </h2>

          <p className="mt-1 text-xs text-muted-foreground">
            Consumed, reserved and remaining authorization.
          </p>
        </div>

        <div className="grid h-10 w-10 place-items-center rounded-lg bg-info/10 text-info ring-1 ring-inset ring-info/20">
          <KeyRound className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-7 flex items-end justify-between">
        <div>
          <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
            {formatINR(
              grant.consumed + grant.reserved,
            )}
          </p>

          <p className="mt-1 text-[11px] text-muted-foreground">
            committed of {formatINR(grant.limit)}
          </p>
        </div>

        <span className="font-mono text-sm font-semibold text-info">
          {grant.usedPercent}%
        </span>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/[0.05]">
        <div className="flex h-full">
          <div
            className="h-full bg-success transition-all"
            style={{
              width: `${consumedPercent}%`,
            }}
          />

          <div
            className="h-full bg-warning transition-all"
            style={{
              width: `${reservedPercent}%`,
            }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <GrantStat
          label="Consumed"
          value={formatINR(grant.consumed)}
          tone="success"
        />

        <GrantStat
          label="Reserved"
          value={formatINR(grant.reserved)}
          tone="warning"
        />

        <GrantStat
          label="Available"
          value={formatINR(grant.remaining)}
          tone="info"
        />
      </div>
    </section>
  )
}

function GrantStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'success' | 'warning' | 'info'
}) {
  return (
    <div className="rounded-lg border border-border bg-white/[0.02] p-3">
      <p className="font-mono text-[8px] uppercase tracking-wider text-subtle">
        {label}
      </p>

      <p
        className={cn(
          'mt-1 font-mono text-xs font-semibold',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'info' && 'text-info',
        )}
      >
        {value}
      </p>
    </div>
  )
}

/*
 * ======================================================
 * THREAT BREAKDOWN
 * ======================================================
 */

function ThreatBreakdown({
  threats,
  maxValue,
  totalDenials,
}: {
  threats: {
    label: string
    value: number
  }[]
  maxValue: number
  totalDenials: number
}) {
  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-subtle">
            Threat intelligence
          </p>

          <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
            Why requests are blocked
          </h2>

          <p className="mt-1 text-xs text-muted-foreground">
            Derived from the real audit trail.
          </p>
        </div>

        <div className="text-right">
          <p className="font-mono text-xl font-semibold text-danger">
            {totalDenials}
          </p>

          <p className="font-mono text-[8px] uppercase tracking-wider text-subtle">
            policy denials
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {threats.map((threat) => (
          <div key={threat.label}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {threat.label}
              </span>

              <span className="font-mono text-[10px] text-foreground">
                {threat.value}
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${(threat.value / maxValue) * 100}%`,
                }}
                transition={{
                  duration: 0.7,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="h-full rounded-full bg-danger"
              />
            </div>
          </div>
        ))}
      </div>

      {totalDenials === 0 && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-[11px] text-success">
          <ShieldCheck className="h-3.5 w-3.5" />
          No policy denials recorded.
        </div>
      )}
    </section>
  )
}

/*
 * ======================================================
 * RECENT ACTIVITY
 * ======================================================
 */

function RecentActivity({
  transactions,
  auditTrail,
}: {
  transactions: DashboardTransaction[]
  auditTrail: AuditEvent[]
}) {
  const events = useMemo(() => {
    const transactionEvents = transactions.map(
      (transaction) => ({
        id: `tx-${transaction.id}`,
        type: 'transaction',
        title:
          isSuccessful(transaction.status)
            ? 'Transaction authorized'
            : isFailed(transaction.status)
              ? 'Transaction rejected'
              : 'Transaction pending',
        description: `${transaction.product} · ${formatINR(
          transaction.amountPaise,
        )}`,
        date: transaction.createdAt,
        status: transaction.status,
      }),
    )

    const auditEvents = auditTrail.map((event) => ({
      id: `audit-${event.id}`,
      type: 'audit',
      title: formatAuditTitle(event.event_type),
      description:
        event.resource ||
        'Trust Layer audit event',
      date: event.date,
      status: 'audit',
    }))

    return [...transactionEvents, ...auditEvents]
      .sort(
        (a, b) =>
          new Date(b.date).getTime() -
          new Date(a.date).getTime(),
      )
      .slice(0, 8)
  }, [transactions, auditTrail])

  return (
    <section className="rounded-2xl border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-subtle">
            Trust Layer activity
          </p>

          <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
            Recent decisions
          </h2>
        </div>

        <Activity className="h-4 w-4 text-subtle" />
      </div>

      <div className="divide-y divide-border/50">
        {events.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-muted-foreground">
            No activity recorded yet.
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-3 px-5 py-3.5"
            >
              <EventIcon status={event.status} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">
                  {event.title}
                </p>

                <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
                  {event.description}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="font-mono text-[9px] text-subtle">
                  {formatTime(event.date)}
                </p>

                <p className="mt-0.5 font-mono text-[8px] uppercase text-subtle">
                  {formatDate(event.date)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function EventIcon({
  status,
}: {
  status: string
}) {
  if (status === 'audit') {
    return (
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-info/10 text-info ring-1 ring-inset ring-info/20">
        <Zap className="h-3.5 w-3.5" />
      </span>
    )
  }

  if (isSuccessful(status)) {
    return (
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-success/10 text-success ring-1 ring-inset ring-success/20">
        <CheckCircle2 className="h-3.5 w-3.5" />
      </span>
    )
  }

  if (isFailed(status)) {
    return (
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-danger/10 text-danger ring-1 ring-inset ring-danger/20">
        <XCircle className="h-3.5 w-3.5" />
      </span>
    )
  }

  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning ring-1 ring-inset ring-warning/20">
      <Clock3 className="h-3.5 w-3.5" />
    </span>
  )
}

function formatAuditTitle(eventType: string) {
  if (!eventType) return 'Trust Layer event'

  return eventType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) =>
      char.toUpperCase(),
    )
}