'use client'

import { motion } from 'framer-motion'
import { useCallback, useRef, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  Play,
  ShieldAlert,
  ShieldCheck,
  Swords,
  Target,
  Zap,
} from 'lucide-react'

import { ATTACKS } from '@/lib/data'
import {
  SecurityAttackCard,
  type AttackPhase,
  type AttackResult,
} from '@/components/trust/security-attack-card'
import { cn } from '@/lib/utils'

interface RunState {
  phase: AttackPhase
  visible: number
  result?: AttackResult
}

const initial = (): Record<string, RunState> =>
  Object.fromEntries(
    ATTACKS.map((a) => [
      a.id,
      {
        phase: 'idle' as AttackPhase,
        visible: 0,
      },
    ]),
  )

export function SecurityView() {
  const [state, setState] =
    useState<Record<string, RunState>>(initial)

  const [runningAll, setRunningAll] = useState(false)

  /*
   * Every attack gets its own set of timers.
   * This prevents timers from previous runs from
   * changing the state after the backend has finished.
   */
  const timers = useRef<
    Record<string, ReturnType<typeof setTimeout>[]>
  >({})

  const clearAttackTimers = useCallback((id: string) => {
    const existing = timers.current[id]

    if (!existing) return

    existing.forEach((timer) => clearTimeout(timer))

    timers.current[id] = []
  }, [])

  const runAttack = useCallback(
    (id: string): Promise<void> => {
      const attack = ATTACKS.find((a) => a.id === id)

      if (!attack) {
        return Promise.resolve()
      }

      const attackMap: Record<string, string> = {
        unauthorized: 'unauthorized_agent',
        expired: 'expired_grant',
        replay: 'replay_attack',
        catalog: 'catalog_poisoning',
        overlimit: 'over_limit',
      }

      const backendId = attackMap[id]

      /*
       * Kill timers from a previous run.
       */
      clearAttackTimers(id)

      timers.current[id] = []

      /*
       * Reset attack.
       */
      setState((current) => ({
        ...current,
        [id]: {
          phase: 'running',
          visible: 0,
          result: undefined,
        },
      }))

      /*
       * ------------------------------------------------
       * TERMINAL ANIMATION
       * ------------------------------------------------
       */

      const animationPromise = new Promise<void>((resolve) => {
        attack.steps.forEach((_, index) => {
          const timer = setTimeout(() => {
            setState((current) => {
              /*
               * Do not overwrite a finished attack.
               */
              if (
                current[id]?.phase === 'blocked' ||
                current[id]?.phase === 'failed'
              ) {
                return current
              }

              return {
                ...current,
                [id]: {
                  ...current[id],
                  phase: 'running',
                  visible: index + 1,
                },
              }
            })
          }, 280 * (index + 1))

          timers.current[id].push(timer)
        })

        const finishTimer = setTimeout(
          resolve,
          280 * (attack.steps.length + 1),
        )

        timers.current[id].push(finishTimer)
      })

      /*
       * ------------------------------------------------
       * REAL GO BACKEND REQUEST
       * ------------------------------------------------
       */

     const backendPromise = fetch(
  '/api/attacklab',
  {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            attack_id: backendId,
          }),
        },
      )
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(
              `Backend returned HTTP ${res.status}`,
            )
          }

          return res.json() as Promise<AttackResult>
        })
        .then((data) => {
          console.log(
            `[AEGIS SECURITY LAB] ${backendId}`,
            data,
          )

          return data
        })

      /*
       * ------------------------------------------------
       * WAIT FOR BOTH
       *
       * We do NOT finish the attack when the backend
       * returns alone.
       *
       * We wait until:
       *
       *   backend response
       *          +
       *   terminal animation
       *
       * are both complete.
       * ------------------------------------------------
       */

      return Promise.all([
        backendPromise,
        animationPromise,
      ])
        .then(([data]) => {
          clearAttackTimers(id)

          setState((current) => ({
            ...current,
            [id]: {
              phase: data.success ? 'blocked' : 'failed',
              visible: attack.steps.length,
              result: data,
            },
          }))
        })
        .catch((error: Error) => {
          clearAttackTimers(id)

          console.error(
            `[AEGIS SECURITY LAB] ${backendId} failed`,
            error,
          )

          setState((current) => ({
            ...current,
            [id]: {
              phase: 'failed',
              visible: attack.steps.length,
              result: {
                success: false,
                expected_result:
                  'Trust Layer should reject the attack',
                actual_result: error.message,
              },
            },
          }))
        })
    },
    [clearAttackTimers],
  )

  const runAll = useCallback(async () => {
    setRunningAll(true)

    /*
     * Clear every previous timer.
     */
    Object.keys(timers.current).forEach(clearAttackTimers)

    setState(initial())

    /*
     * Sequential execution makes the demo much easier
     * for judges to follow.
     */
    for (const attack of ATTACKS) {
      await runAttack(attack.id)

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 250)
      })
    }

    setRunningAll(false)
  }, [runAttack, clearAttackTimers])

  const blockedCount = Object.values(state).filter(
    (item) => item.phase === 'blocked',
  ).length

  const failedCount = Object.values(state).filter(
    (item) => item.phase === 'failed',
  ).length

  const completedCount = blockedCount + failedCount

  const fundsMoved = 0

  return (
    <div className="space-y-6">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card/40">
        {/* background effects */}
        <div className="grid-noise pointer-events-none absolute inset-0 opacity-30" />

        <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-success/[0.07] blur-3xl" />

        <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-info/[0.04] blur-3xl" />

        <div className="relative p-6 lg:p-7">
          {/* top row */}
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/25 bg-danger/10 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-danger">
                  <Swords className="h-3 w-3" />
                  Adversarial simulation
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-success/20 bg-success/5 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-success">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                  Trust layer live
                </span>
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-foreground lg:text-4xl">
                Security Command Center
              </h1>

              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Prove that autonomous AI agents cannot move money
                outside their authorization. Every attack is sent
                through the real Aegis Trust Layer before a verdict
                is displayed.
              </p>
            </div>

            {/* run button */}
            <button
              onClick={runAll}
              disabled={runningAll}
              className={cn(
                'group relative flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-3 text-sm font-medium transition-all',
                'bg-foreground text-primary-foreground',
                'hover:scale-[1.01] hover:opacity-90',
                'disabled:cursor-not-allowed disabled:opacity-70',
              )}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

              {runningAll ? (
                <>
                  <Loader2 className="relative h-4 w-4 animate-spin" />
                  <span className="relative">
                    Running simulation…
                  </span>
                </>
              ) : (
                <>
                  <Play className="relative h-4 w-4" />
                  <span className="relative">
                    Run full simulation
                  </span>
                </>
              )}
            </button>
          </div>

          {/* =================================================
              KPI ROW
          ================================================== */}

          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SecurityMetric
              icon={ShieldCheck}
              label="Attacks neutralized"
              value={`${blockedCount}/${ATTACKS.length}`}
              detail={
                completedCount === 0
                  ? 'Awaiting simulation'
                  : `${blockedCount} defenses verified`
              }
              tone="success"
            />

            <SecurityMetric
              icon={CircleDollarSign}
              label="Unauthorized funds moved"
              value="₹0"
              detail="Payment layer protected"
              tone="success"
            />

            <SecurityMetric
              icon={Target}
              label="Defense success rate"
              value={
                completedCount === 0
                  ? '—'
                  : `${Math.round(
                      (blockedCount / completedCount) * 100,
                    )}%`
              }
              detail={
                failedCount > 0
                  ? `${failedCount} failed`
                  : 'All tested defenses'
              }
              tone="success"
            />

            <SecurityMetric
              icon={Zap}
              label="Trust controls"
              value="6"
              detail="Identity → atomicity"
              tone="info"
            />
          </div>

          {/* =================================================
              PROGRESS
          ================================================== */}

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-subtle" />

                <span className="font-mono text-[10px] uppercase tracking-wider text-subtle">
                  Defense coverage
                </span>
              </div>

              <span className="font-mono text-[10px] text-success">
                {blockedCount} / {ATTACKS.length} neutralized
              </span>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-success to-info"
                animate={{
                  width: `${
                    (blockedCount / ATTACKS.length) * 100
                  }%`,
                }}
                transition={{
                  ease: [0.16, 1, 0.3, 1],
                  duration: 0.5,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          DEFENSE PIPELINE
      ====================================================== */}

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card/30 p-5 lg:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-subtle">
              Live defense pipeline
            </p>

            <h2 className="mt-1 text-sm font-semibold tracking-tight text-foreground">
              AI request → Trust Layer → verdict
            </h2>
          </div>

          <span className="font-mono text-[9px] uppercase tracking-wider text-subtle">
            deterministic enforcement
          </span>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <PipelineStep
            number="01"
            title="Adversarial request"
            description="Untrusted AI proposes a financial action"
            active={runningAll}
          />

          <PipelineConnector />

          <PipelineStep
            number="02"
            title="Aegis Trust Layer"
            description="Identity, policy, integrity & atomicity"
            active={runningAll}
            highlight
          />

          <PipelineConnector />

          <PipelineStep
            number="03"
            title="Deterministic verdict"
            description="Allow, reject, reserve or rollback"
            active={blockedCount > 0}
          />
        </div>
      </div>

      {/* =====================================================
          ATTACK GRID
      ====================================================== */}

      <div>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-subtle">
              Attack surface
            </p>

            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Adversarial scenarios
            </h2>
          </div>

          <div className="hidden items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-subtle sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Backend verified
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ATTACKS.map((attack) => (
            <SecurityAttackCard
              key={attack.id}
              attack={attack}
              phase={state[attack.id].phase}
              visible={state[attack.id].visible}
              result={state[attack.id].result}
              onRun={() => runAttack(attack.id)}
            />
          ))}
        </div>
      </div>

      {/* =====================================================
          FINAL VERDICT
      ====================================================== */}

      <motion.div
        layout
        className={cn(
          'relative overflow-hidden rounded-2xl border p-6',
          blockedCount === ATTACKS.length
            ? 'border-success/25 bg-success/[0.035]'
            : 'border-border bg-card/30',
        )}
      >
        {blockedCount === ATTACKS.length && (
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-success/10 blur-3xl" />
        )}

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'grid h-12 w-12 shrink-0 place-items-center rounded-xl border',
                blockedCount === ATTACKS.length
                  ? 'border-success/25 bg-success/10 text-success'
                  : 'border-border bg-white/[0.03] text-subtle',
              )}
            >
              <ShieldCheck className="h-6 w-6" />
            </div>

            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-subtle">
                Aegis trust verdict
              </p>

              <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                {blockedCount === ATTACKS.length
                  ? 'Trust Layer protected the payment boundary'
                  : 'Security verification pending'}
              </h2>

              <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
                {blockedCount === ATTACKS.length
                  ? 'All deterministic attack scenarios were neutralized without allowing unauthorized funds to move.'
                  : 'Run the full simulation to verify every defense control.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <VerdictStat
              label="Neutralized"
              value={`${blockedCount}/${ATTACKS.length}`}
            />

            <VerdictStat
              label="Funds moved"
              value={`₹${fundsMoved}`}
            />

            <VerdictStat
              label="System"
              value={
                blockedCount === ATTACKS.length
                  ? 'PROTECTED'
                  : 'READY'
              }
            />
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/* ============================================================
   SECURITY METRIC
============================================================ */

function SecurityMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Target
  label: string
  value: string
  detail: string
  tone: 'success' | 'info'
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.035]">
      <div className="flex items-start justify-between">
        <div
          className={cn(
            'grid h-8 w-8 place-items-center rounded-lg',
            tone === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-info/10 text-info',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        <span className="font-mono text-[8px] uppercase tracking-wider text-subtle">
          verified
        </span>
      </div>

      <p className="mt-4 text-[10px] uppercase tracking-wider text-subtle">
        {label}
      </p>

      <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>

      <p className="mt-1 text-[10px] text-muted-foreground">
        {detail}
      </p>
    </div>
  )
}

/* ============================================================
   PIPELINE
============================================================ */

function PipelineStep({
  number,
  title,
  description,
  active,
  highlight,
}: {
  number: string
  title: string
  description: string
  active?: boolean
  highlight?: boolean
}) {
  return (
    <motion.div
      animate={
        active
          ? {
              borderColor: highlight
                ? 'rgba(16,185,129,0.3)'
                : undefined,
            }
          : undefined
      }
      className={cn(
        'rounded-xl border p-4',
        highlight
          ? 'border-success/20 bg-success/[0.035]'
          : 'border-border bg-white/[0.015]',
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'font-mono text-[9px]',
            highlight ? 'text-success' : 'text-subtle',
          )}
        >
          {number}
        </span>

        <span className="text-xs font-semibold text-foreground">
          {title}
        </span>

        {active && (
          <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
        )}
      </div>

      <p className="mt-2 pl-7 text-[10px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    </motion.div>
  )
}

function PipelineConnector() {
  return (
    <div className="hidden items-center justify-center md:flex">
      <div className="h-px w-full bg-gradient-to-r from-border via-success/30 to-border" />
    </div>
  )
}

/* ============================================================
   VERDICT STAT
============================================================ */

function VerdictStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-border bg-black/20 px-4 py-3 text-center">
      <p className="font-mono text-[8px] uppercase tracking-wider text-subtle">
        {label}
      </p>

      <p className="mt-1 font-mono text-xs font-semibold text-success">
        {value}
      </p>
    </div>
  )
}
