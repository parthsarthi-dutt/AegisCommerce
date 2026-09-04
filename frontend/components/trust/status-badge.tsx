import { cn } from '@/lib/utils'
import type { TxStatus } from '@/lib/data'

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const TONE: Record<Tone, { dot: string; text: string; bg: string; ring: string }> = {
  success: {
    dot: 'bg-success shadow-[0_0_8px_1px] shadow-success/60',
    text: 'text-success',
    bg: 'bg-success/10',
    ring: 'ring-success/20',
  },
  warning: {
    dot: 'bg-warning shadow-[0_0_8px_1px] shadow-warning/60',
    text: 'text-warning',
    bg: 'bg-warning/10',
    ring: 'ring-warning/20',
  },
  danger: {
    dot: 'bg-danger shadow-[0_0_8px_1px] shadow-danger/60',
    text: 'text-danger',
    bg: 'bg-danger/10',
    ring: 'ring-danger/20',
  },
  info: {
    dot: 'bg-info shadow-[0_0_8px_1px] shadow-info/60',
    text: 'text-info',
    bg: 'bg-info/10',
    ring: 'ring-info/20',
  },
  neutral: {
    dot: 'bg-neutral shadow-[0_0_8px_1px] shadow-neutral/60',
    text: 'text-neutral',
    bg: 'bg-neutral/10',
    ring: 'ring-neutral/20',
  },
}

const STATUS_TONE: Record<string, Tone> = {
  captured: 'success',
  payment_pending: 'warning',
  failed: 'danger',
  payment_failed: 'danger',
  authorized: 'info',
  released: 'neutral',
  reserved: 'warning',
  created: 'info',
}

const STATUS_LABEL: Record<string, string> = {
  captured: 'CAPTURED',
  payment_pending: 'PENDING',
  failed: 'FAILED',
  payment_failed: 'FAILED',
  authorized: 'AUTHORIZED',
  released: 'RELEASED',
  reserved: 'RESERVED',
  created: 'CREATED',
}

export function StatusBadge({
  status,
  className,
  pulse = true,
}: {
  status: TxStatus
  className?: string
  pulse?: boolean
}) {
  const tone = STATUS_TONE[status] ?? 'neutral'
  const c = TONE[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider ring-1 ring-inset',
        c.bg,
        c.text,
        c.ring,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', c.dot, pulse && 'animate-pulse')} />
      {STATUS_LABEL[status] ?? status.toUpperCase()}
    </span>
  )
}

export function Dot({ tone = 'success', className }: { tone?: Tone; className?: string }) {
  return (
    <span
      className={cn('h-1.5 w-1.5 rounded-full', TONE[tone].dot, className)}
      aria-hidden="true"
    />
  )
}

export function toneClasses(tone: Tone) {
  return TONE[tone]
}

export type { Tone }
