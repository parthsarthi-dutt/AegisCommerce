'use client'

import { motion } from 'framer-motion'
import { Bell, Menu, Search } from 'lucide-react'
import type { View } from './sidebar'

const TITLES: Record<View, { title: string; sub: string }> = {
  overview: { title: 'Overview', sub: 'Trust infrastructure at a glance' },
  transactions: { title: 'Transactions', sub: 'AI-initiated financial activity' },
  audit: { title: 'Audit Trail', sub: 'Immutable decision ledger' },
  security: { title: 'Security Lab', sub: 'Adversarial simulation' },
  'ai-agent': { title: 'AI Sales Agent', sub: 'AI Revenue + Trust Infrastructure' },
}

export function TopBar({ view, onMenu }: { view: View; onMenu: () => void }) {
  const t = TITLES[view]
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/70 px-4 backdrop-blur-xl md:px-6">
      <button
        onClick={onMenu}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground ring-1 ring-inset ring-border transition-colors hover:text-foreground lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="hidden flex-col leading-tight sm:flex">
        <h1 className="text-sm font-semibold tracking-tight text-foreground">
          Aegis Commerce
          <span className="mx-1.5 text-subtle">/</span>
          <span className="text-muted-foreground">{t.title}</span>
        </h1>
        <p className="text-[11px] text-subtle">{t.sub}</p>
      </div>

      <div className="ml-auto flex items-center gap-2">
      </div>
    </header>
  )
}
