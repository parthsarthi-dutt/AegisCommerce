'use client'

import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion'
import { useEffect, useRef, type ComponentType } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toneClasses, type Tone } from './status-badge'

interface MetricCardProps {
  label: string
  value: number
  prefix?: string
  format?: 'currency' | 'number'
  tone: Tone
  icon: ComponentType<{ className?: string }>
  trend: number
  trendLabel: string
  index?: number
}

function useCountUp(target: number, start: boolean) {
  const mv = useMotionValue(0)
  const rounded = useTransform(mv, (v) => Math.round(v))
  useEffect(() => {
    if (!start) return
    const controls = animate(mv, target, { duration: 1.1, ease: [0.16, 1, 0.3, 1] })
    return controls.stop
  }, [start, target, mv])
  return rounded
}

export function MetricCard({
  label,
  value,
  prefix = '',
  format = 'number',
  tone,
  icon: Icon,
  trend,
  trendLabel,
  index = 0,
}: MetricCardProps) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const count = useCountUp(format === 'currency' ? Math.round(value / 100) : value, inView)
  const c = toneClasses(tone)
  const up = trend >= 0

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className="group relative overflow-hidden rounded-xl border border-border bg-card/60 p-5"
    >
      <div
        className={cn(
          'pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100',
          c.bg,
        )}
      />
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-subtle">{label}</span>
        <span className={cn('grid h-8 w-8 place-items-center rounded-lg ring-1 ring-inset', c.bg, c.ring)}>
          <Icon className={cn('h-4 w-4', c.text)} />
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
          {prefix}
          <motion.span>{count}</motion.span>
        </span>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <span
          className={cn(
            'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
            up ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
          )}
        >
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(trend)}%
        </span>
        <span className="text-[11px] text-subtle">{trendLabel}</span>
      </div>
    </motion.div>
  )
}
