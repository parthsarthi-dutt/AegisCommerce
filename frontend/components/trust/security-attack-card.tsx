'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
  ShieldOff,
  Clock,
  Repeat,
  FileWarning,
  TrendingUp,
  Loader2,
  ShieldCheck,
  Play,
  CheckCircle2,
  CircleDollarSign,
  Server,
  type LucideIcon,
} from 'lucide-react'

import type { Attack } from '@/lib/data'
import { TerminalOutput } from './terminal-output'
import { cn } from '@/lib/utils'

export type AttackPhase =
  | 'idle'
  | 'running'
  | 'blocked'
  | 'failed'

export interface AttackResult {
  success: boolean
  expected_result: string
  actual_result: string
  details?: unknown
}

const ICONS: Record<string, LucideIcon> = {
  unauthorized: ShieldOff,
  expired: Clock,
  replay: Repeat,
  catalog: FileWarning,
  overlimit: TrendingUp,
}

const SEV_TONE: Record<Attack['severity'], string> = {
  Critical:
    'border-danger/25 bg-danger/10 text-danger',

  High:
    'border-warning/25 bg-warning/10 text-warning',

  Medium:
    'border-info/25 bg-info/10 text-info',
}

export function SecurityAttackCard({
  attack,
  phase,
  visible,
  result,
  onRun,
}: {
  attack: Attack
  phase: AttackPhase
  visible: number
  result?: AttackResult
  onRun: () => void
}) {
  const Icon = ICONS[attack.id] ?? ShieldOff

  const active = phase !== 'idle'

  const completed =
    phase === 'blocked' || phase === 'failed'

  return (
    <motion.div
      layout
      initial={{
        opacity: 0,
        y: 12,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.4,
      }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-card/50 transition-all',
        phase === 'blocked' &&
          'border-success/30 shadow-[0_0_40px_rgba(16,185,129,0.04)]',
        phase === 'failed' &&
          'border-danger/30',
        phase === 'running' &&
          'border-danger/20',
        phase === 'idle' &&
          'border-border',
      )}
    >
      {/* glow */}

      {phase === 'blocked' && (
        <span className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-success/10 blur-3xl" />
      )}

      {phase === 'running' && (
        <span className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-danger/10 blur-3xl" />
      )}

      {/* =====================================================
          CARD HEADER
      ====================================================== */}

      <div className="relative flex items-start gap-3 p-4">
        <motion.div
          animate={
            phase === 'running'
              ? {
                  scale: [1, 1.04, 1],
                }
              : undefined
          }
          transition={{
            repeat: Infinity,
            duration: 1.2,
          }}
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset transition-colors',
            phase === 'blocked'
              ? 'bg-success/10 text-success ring-success/25'
              : phase === 'failed'
                ? 'bg-danger/10 text-danger ring-danger/25'
                : 'bg-danger/10 text-danger ring-danger/25',
          )}
        >
          {phase === 'blocked' ? (
            <ShieldCheck className="h-4.5 w-4.5" />
          ) : (
            <Icon className="h-4.5 w-4.5" />
          )}
        </motion.div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] tabular-nums text-subtle">
              {String(attack.index).padStart(2, '0')}
            </span>

            <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
              {attack.name}
            </h3>
          </div>

          <span
            className={cn(
              'mt-1 inline-block rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider',
              SEV_TONE[attack.severity],
            )}
          >
            {attack.severity}
          </span>
        </div>

        {/* status */}

        {phase === 'blocked' && (
          <span className="inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-success">
            <CheckCircle2 className="h-3 w-3" />
            Blocked
          </span>
        )}

        {phase === 'failed' && (
          <span className="rounded-full border border-danger/20 bg-danger/10 px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-danger">
            Failed
          </span>
        )}
      </div>

      {/* =====================================================
          DESCRIPTION
      ====================================================== */}

      <div className="relative flex-1 space-y-3 px-4 pb-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {attack.description}
        </p>

        {/* expected defense */}

        <div className="rounded-lg border border-border bg-white/[0.02] px-3 py-2.5">
          <p className="font-mono text-[9px] uppercase tracking-wider text-subtle">
            Trust control
          </p>

          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-foreground/90">
            <ShieldCheck className="h-3 w-3 shrink-0 text-success" />
            {attack.defenseLabel}
          </p>
        </div>

        {/* =================================================
            TERMINAL
        ================================================== */}

        <AnimatePresence initial={false}>
          {active && (
            <motion.div
              initial={{
                opacity: 0,
                height: 0,
              }}
              animate={{
                opacity: 1,
                height: 'auto',
              }}
              exit={{
                opacity: 0,
                height: 0,
              }}
              className="overflow-hidden"
            >
              <TerminalOutput
                steps={attack.steps}
                visible={visible}
                title={`attack://${attack.id}`}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* =================================================
            BACKEND VERDICT
        ================================================== */}

        <AnimatePresence>
          {completed && result && (
            <motion.div
              initial={{
                opacity: 0,
                y: 6,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.25,
              }}
              className={cn(
                'space-y-3 rounded-lg border p-3',
                result.success
                  ? 'border-success/20 bg-success/[0.045]'
                  : 'border-danger/20 bg-danger/[0.045]',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <ShieldOff className="h-4 w-4 text-danger" />
                  )}

                  <span
                    className={cn(
                      'text-xs font-semibold tracking-tight',
                      result.success
                        ? 'text-success'
                        : 'text-danger',
                    )}
                  >
                    {result.success
                      ? 'THREAT NEUTRALIZED'
                      : 'DEFENSE FAILED'}
                  </span>
                </div>

                <span className="font-mono text-[8px] uppercase tracking-wider text-subtle">
                  backend verified
                </span>
              </div>

              {/* backend data */}

              <div className="space-y-1.5 rounded-md border border-border bg-black/20 p-2.5">
                <BackendRow
                  label="expected"
                  value={result.expected_result}
                />

                <BackendRow
                  label="actual"
                  value={result.actual_result}
                />
              </div>

              {/* funds */}

              {result.success && (
                <div className="flex items-center justify-between border-t border-success/10 pt-2">
                  <div className="flex items-center gap-1.5">
                    <CircleDollarSign className="h-3 w-3 text-success" />

                    <span className="font-mono text-[9px] uppercase tracking-wider text-subtle">
                      unauthorized funds moved
                    </span>
                  </div>

                  <span className="font-mono text-xs font-semibold text-success">
                    ₹0
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* =====================================================
          ACTION
      ====================================================== */}

      <div className="relative border-t border-border p-3">
        <button
          onClick={onRun}
          disabled={phase === 'running'}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-all disabled:cursor-not-allowed',
            phase === 'blocked'
              ? 'bg-success/10 text-success ring-1 ring-inset ring-success/25 hover:bg-success/15'
              : phase === 'failed'
                ? 'bg-danger/10 text-danger ring-1 ring-inset ring-danger/25 hover:bg-danger/15'
                : phase === 'running'
                  ? 'bg-danger/10 text-danger ring-1 ring-inset ring-danger/25'
                  : 'bg-white/[0.05] text-foreground ring-1 ring-inset ring-white/10 hover:bg-white/[0.09]',
          )}
        >
          {phase === 'running' ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Executing against Trust Layer…
            </>
          ) : phase === 'blocked' ? (
            <>
              <Repeat className="h-3.5 w-3.5" />
              Run attack again
            </>
          ) : phase === 'failed' ? (
            <>
              <Repeat className="h-3.5 w-3.5" />
              Retry attack
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              Run live attack
            </>
          )}
        </button>
      </div>
    </motion.div>
  )
}

/* ============================================================
   BACKEND ROW
============================================================ */

function BackendRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="grid grid-cols-[55px_1fr] gap-2">
      <span className="font-mono text-[8px] uppercase tracking-wider text-subtle">
        {label}
      </span>

      <span className="line-clamp-2 font-mono text-[9px] leading-relaxed text-foreground/75">
        {value}
      </span>
    </div>
  )
}