'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Sidebar, type View } from '@/components/trust/sidebar'
import { TopBar } from '@/components/trust/top-bar'
import { OverviewView } from '@/components/views/overview-view'
import { TransactionsView } from '@/components/views/transactions-view'
import { AuditView } from '@/components/views/audit-view'
import { SecurityView } from '@/components/views/security-view'
import { AIAgentView } from '@/components/views/ai-agent-view'

export default function Page() {
  const [view, setView] = useState<View>('overview')
  const [mobileNav, setMobileNav] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border lg:block">
        <Sidebar view={view} onChange={setView} />
      </aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {mobileNav && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNav(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="fixed inset-y-0 left-0 z-50 w-60 border-r border-border lg:hidden"
            >
              <Sidebar view={view} onChange={setView} onNavigate={() => setMobileNav(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <TopBar view={view} onMenu={() => setMobileNav(true)} />
        <main className="scrollbar-thin flex-1 px-4 py-5 md:px-6 md:py-6">
          <div className="mx-auto max-w-[1400px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                {view === 'overview' && <OverviewView onNavigate={setView} />}
                {view === 'ai-agent' && <AIAgentView />}
                {view === 'transactions' && <TransactionsView />}
                {view === 'audit' && <AuditView />}
                {view === 'security' && <SecurityView />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}
