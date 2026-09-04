import { cn } from '@/lib/utils'

const COLORS = [
  'text-chart-1',
  'text-chart-2',
  'text-chart-3',
  'text-chart-4',
]

function colorFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % COLORS.length
  return COLORS[h]
}

export function AgentBadge({ id, className }: { id: string; className?: string }) {
  const short = id.length > 10 ? id.slice(0, 10) : id
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-xs text-foreground/90',
        className,
      )}
    >
      <span
        className={cn(
          'grid h-4 w-4 place-items-center rounded-[4px] bg-white/[0.06] text-[9px] font-semibold ring-1 ring-inset ring-white/10',
          colorFor(id),
        )}
        aria-hidden="true"
      >
        A
      </span>
      {short}
    </span>
  )
}
