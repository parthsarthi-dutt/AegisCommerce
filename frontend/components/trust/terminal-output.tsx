'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AttackStep } from '@/lib/data'

export function TerminalOutput({
  steps,
  visible,
  title = 'trust-layer://security-lab',
}: {
  steps: AttackStep[]
  visible: number
  title?: string
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-[oklch(0.12_0.004_285.8)]">
      <div className="flex items-center gap-2 border-b border-border/70 bg-white/[0.02] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <span className="ml-2 font-mono text-[10.5px] text-subtle">{title}</span>
      </div>
      <div className="scrollbar-thin max-h-52 overflow-y-auto p-3 font-mono text-xs leading-relaxed">
        <AnimatePresence initial={false}>
          {steps.slice(0, visible).map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 py-[3px]"
            >
              {s.ok === undefined ? (
                <span className="text-info/80">$</span>
              ) : s.ok ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-success" />
              ) : (
                <X className="h-3.5 w-3.5 shrink-0 text-danger" />
              )}
              <span
                className={cn(
                  s.ok === undefined && 'text-foreground/80',
                  s.ok === true && 'text-success',
                  s.ok === false && 'text-danger',
                )}
              >
                {s.cmd}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        {visible < steps.length && (
          <span className="ml-4 inline-block h-3.5 w-2 animate-pulse bg-foreground/60 align-middle" />
        )}
      </div>
    </div>
  )
}

const KEY_RE = /"([^"]+)":/g

function highlight(json?: string) {
  return (json ?? '').split('\n').map((line, i) => {
    const parts: React.ReactNode[] = []
    let last = 0
    let m: RegExpExecArray | null

    KEY_RE.lastIndex = 0

    while ((m = KEY_RE.exec(line))) {
      if (m.index > last) {
        parts.push(line.slice(last, m.index))
      }

      parts.push(
        <span key={`k${i}-${m.index}`} className="text-info">
          &quot;{m[1]}&quot;
        </span>,
      )

      parts.push(':')
      last = m.index + m[0].length
    }

    const rest = line.slice(last)

    const restNode = rest
      .replace(/("(?:[^"\\]|\\.)*")/g, '\u0000$1\u0000')
      .split('\u0000')
      .map((seg, j) => {
        if (seg.startsWith('"')) {
          return (
            <span key={`s${i}-${j}`} className="text-success">
              {seg}
            </span>
          )
        }

        return seg
          .split(/(\b\d[\d_]*\b|\btrue\b|\bfalse\b|\bnull\b)/g)
          .map((tk, k) => {
            if (/^\d/.test(tk)) {
              return (
                <span
                  key={`n${i}-${j}-${k}`}
                  className="text-warning"
                >
                  {tk}
                </span>
              )
            }

            if (tk === 'true' || tk === 'false' || tk === 'null') {
              return (
                <span
                  key={`b${i}-${j}-${k}`}
                  className="text-neutral"
                >
                  {tk}
                </span>
              )
            }

            return tk
          })
      })

    parts.push(<span key={`r${i}`}>{restNode}</span>)

    return (
      <div key={i} className="whitespace-pre">
        {parts}
      </div>
    )
  })
}

export function JsonBlock({
  data,
  className,
}: {
  data?: Record<string, unknown>
  className?: string
}) {
  if (!data) return null;
  const json = JSON.stringify(data, null, 2) ?? '{}'

  return (
    <pre
      className={cn(
        'scrollbar-thin overflow-x-auto rounded-lg border border-border bg-[oklch(0.12_0.004_285.8)] p-3 font-mono text-[11.5px] leading-relaxed text-foreground/80',
        className,
      )}
    >
      <code>{highlight(json)}</code>
    </pre>
  )
}
