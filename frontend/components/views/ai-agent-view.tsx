import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import Script from "next/script"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles,
  Cpu,
  Database,
  Shield,
  ShieldCheck,
  Check,
  Loader,
  Activity,
  Fingerprint,
  Scale,
  Hash,
  Lock,
  Wallet,
  ArrowRight,
  TriangleAlert,
  Ban,
  CircleCheck,
  Trash,
} from "lucide-react"

/* -------------------------------------------------------------------------- */
/*  Mock data — architected so it can be swapped for API responses later.      */
/* -------------------------------------------------------------------------- */

type Product = {
  id: string
  name: string
  price: number
  kind: "base" | "recommendation"
  blurb: string
  icon: typeof Sparkles
}

const PRODUCTS: Product[] = [
  {
    id: "prod_dev_plan",
    name: "AI Developer Plan",
    price: 500,
    kind: "base",
    blurb: "Production-ready AI development environment.",
    icon: Sparkles,
  },
  {
    id: "prod_compute",
    name: "Compute Credits",
    price: 299,
    kind: "recommendation",
    blurb: "Inference and workload capacity.",
    icon: Cpu,
  },
  {
    id: "prod_vector",
    name: "Vector DB Credits",
    price: 199,
    kind: "recommendation",
    blurb: "Semantic search and retrieval capacity.",
    icon: Database,
  },
]

const META = {
  agent: "agent_7f92a1",
  grant: "grant_44444444",
  idempotency: "idem_8f2c91",
  catalogHash: "7e9cc133...",
  currency: "INR",
  environment: "TEST",
  policy: "DEFAULT_COMMERCE_POLICY",
  authMax: 1000,
}

const TRUST_CHECKS = [
  { id: "identity", label: "Agent Identity Validated", event: "verify_agent_identity()", icon: Fingerprint },
  { id: "grant", label: "Authorization Grant Sufficient", event: "check_grant_ceiling()", icon: Scale },
  { id: "policy", label: "Policy Engine Evaluated", event: "evaluate_policy()", icon: Shield },
  { id: "catalog", label: "Catalog Integrity Hash Matched", event: "match_catalog_hash()", icon: Hash },
  { id: "idem", label: "Idempotency Key Unique", event: "assert_idempotent()", icon: Activity },
  { id: "reserve", label: "PostgreSQL Atomic Reservation Locked", event: "reserve_funds_tx()", icon: Lock },
]

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`

/* -------------------------------------------------------------------------- */
/*  Small shared primitives                                                    */
/* -------------------------------------------------------------------------- */

function Mono({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
      {children}
    </span>
  )
}

function StatusDot({ color = "emerald" }: { color?: "emerald" | "amber" | "red" }) {
  const map = {
    emerald: "bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400/70",
    amber: "bg-amber-400 shadow-[0_0_10px] shadow-amber-400/70",
    red: "bg-red-400 shadow-[0_0_10px] shadow-red-400/70",
  }
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${map[color]}`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${map[color]}`} />
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  Header                                                                     */
/* -------------------------------------------------------------------------- */

function PageHeader() {
  return (
    <header className="border-b border-white/[0.08]">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-5 py-6 md:px-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.03]">
              <ShieldCheck className="h-4 w-4 text-emerald-400" strokeWidth={1.75} />
            </div>
            <div className="leading-tight">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-300">
                Aegis Commerce
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                AI Revenue Infrastructure
              </div>
            </div>
          </div>

          <div className="max-w-2xl">
            <h1 className="text-pretty text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
              AI Sales Agent
            </h1>
            <p className="mt-1 text-pretty text-sm font-medium text-zinc-300">
              Turn customer intent into trusted revenue.
            </p>
            <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-zinc-500">
              Autonomously discover, recommend and prepare purchases — while Aegis independently
              controls every financial action.
            </p>
          </div>
        </div>

        <div className="flex flex-row items-center gap-3 lg:flex-col lg:items-end">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5">
            <StatusDot />
            <span className="text-xs font-medium text-emerald-300">Trust Layer Operational</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300">
              Test Mode
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

/* -------------------------------------------------------------------------- */
/*  Revenue opportunity bar                                                    */
/* -------------------------------------------------------------------------- */

function RevenueBar({ data }: { data: any }) {
  const transactions = data?.transactions || []

  // Base product: category 'software' or name includes 'Developer'/'Premium'
  const isBase = (t: any) => t.product?.toLowerCase().includes('developer') || t.product?.toLowerCase().includes('premium') || t.product?.category === 'software'
  // Upsell product: category 'credits' or name includes 'Credits'
  const isUpsell = (t: any) => t.product?.toLowerCase().includes('credits') || t.product?.category === 'credits'

  const successfulTxs = transactions.filter((t: any) => t.status === 'captured')

  const baseRevenuePaise = successfulTxs
    .filter(isBase)
    .reduce((sum: number, t: any) => sum + (t.amountPaise || 0), 0)

  const incrementalRevenuePaise = successfulTxs
    .filter(isUpsell)
    .reduce((sum: number, t: any) => sum + (t.amountPaise || 0), 0)

  const totalRevenuePaise = baseRevenuePaise + incrementalRevenuePaise

  const baseRevenue = baseRevenuePaise / 100
  const incrementalRevenue = incrementalRevenuePaise / 100
  const totalRevenue = totalRevenuePaise / 100

  const lift = baseRevenue > 0 ? (incrementalRevenue / baseRevenue) * 100 : 0

  const stats = [
    { label: "Base Revenue", value: inr(baseRevenue), sub: "Verified customer intent", tone: "text-zinc-50" },
    { label: "Total Assisted Revenue", value: inr(totalRevenue), sub: "Base + Recommended", tone: "text-zinc-50" },
    { label: "Incremental Revenue", value: `+${inr(incrementalRevenue)}`, sub: "AI-attributed upsell", tone: "text-emerald-400" },
    { label: "Revenue Lift", value: `+${lift.toFixed(1)}%`, sub: "Basket expansion", tone: "text-emerald-400" },
  ]
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="border-b border-white/[0.08] bg-white/[0.01]"
    >
      <div className="mx-auto max-w-[1440px] px-5 py-4 md:px-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-1 w-1 rounded-full bg-emerald-400" />
          <Kicker>Live Backend Metrics</Kicker>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.04] lg:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className="bg-[#080808] p-4">
              <Kicker>{s.label}</Kicker>
              <div className={`mt-2 font-mono text-2xl font-semibold tracking-tight ${s.tone}`}>
                {i === 1 ? (
                  <span className="flex items-baseline gap-2">
                    {s.value}
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-600" />
                  </span>
                ) : (
                  s.value
                )}
              </div>
              <div className="mt-1 text-xs text-zinc-500">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}


/* -------------------------------------------------------------------------- */
/*  Conversation pieces                                                        */
/* -------------------------------------------------------------------------- */

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
}

function CustomerBubble({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      variants={fadeUp}
      transition={{ duration: 0.45, delay }}
      className="flex justify-end"
    >
      <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-white/10 bg-white/[0.05] px-4 py-3">
        <div className="mb-1 flex items-center justify-end gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            Customer
          </span>
        </div>
        <p className="text-sm leading-relaxed text-zinc-200">{children}</p>
      </div>
    </motion.div>
  )
}

function AgentMessage({ children, delay = 0 }: { children?: React.ReactNode; delay?: number }) {
  return (
    <motion.div variants={fadeUp} transition={{ duration: 0.45, delay }} className="flex justify-start">
      <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.75} />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-300/80">
            AI Revenue Agent
          </span>
        </div>
        <div className="text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap">
          {typeof children === 'string' ? (
            children.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-semibold text-zinc-50">{part.slice(2, -2)}</strong>;
              }
              if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={i} className="italic text-zinc-300">{part.slice(1, -1)}</em>;
              }
              return part;
            })
          ) : (
            children || "I have retrieved the requested products."
          )}
        </div>
      </div>
    </motion.div>
  )
}

function ToolTrace({ delay = 0 }: { delay?: number }) {
  const checks = [
    "Intent detected",
    "Catalog searched",
    "Compatible products identified",
    "Upsell opportunity detected",
    "Purchase recommendation generated",
  ]
  const events = ["search_products()", "recommend_products()", "create_purchase_intent()"]
  return (
    <motion.div
      variants={fadeUp}
      transition={{ duration: 0.45, delay }}
      className="ml-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <Activity className="h-3 w-3 text-zinc-500" />
        <Kicker>Agent Execution Trace</Kicker>
      </div>
      <div className="grid gap-1.5">
        {checks.map((c, i) => (
          <motion.div
            key={c}
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: delay + i * 0.08 }}
            className="flex items-center gap-2"
          >
            <Check className="h-3 w-3 text-emerald-400" strokeWidth={2.5} />
            <span className="text-xs text-zinc-400">{c}</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-3">
        {events.map((e) => (
          <span
            key={e}
            className="rounded border border-white/[0.08] bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500"
          >
            {e}
          </span>
        ))}
      </div>
    </motion.div>
  )
}

function ProductCard({ product, delay }: { product: Product; delay: number }) {
  const Icon = product.icon
  const isBase = product.kind === "base"
  return (
    <motion.div
      variants={fadeUp}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -3 }}
      className={`group relative flex flex-col rounded-xl border p-4 transition-colors ${
        isBase
          ? "border-white/10 bg-white/[0.03]"
          : "border-emerald-500/15 bg-emerald-500/[0.03]"
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
            isBase
              ? "border-white/10 bg-white/[0.04] text-zinc-300"
              : "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400"
          }`}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        {isBase ? (
          <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400">
            Base Product
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/[0.08] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-300">
            <Sparkles className="h-2.5 w-2.5" />
            AI Recommended
          </span>
        )}
      </div>
      <div className="text-sm font-medium text-zinc-50">{product.name}</div>
      <div className="mt-0.5 font-mono text-lg font-semibold text-zinc-100">{inr(product.price)}</div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">{product.blurb}</p>
    </motion.div>
  )
}

function SystemEvent({ label, delay = 0 }: { label: string; delay?: number }) {
  const time = "12:04:18.221"
  return (
    <motion.div
      variants={fadeUp}
      transition={{ duration: 0.4, delay }}
      className="flex items-center gap-2 pl-1"
    >
      <span className="h-1 w-1 rounded-full bg-emerald-400" />
      <Mono className="text-[11px] text-emerald-300/80">{label}</Mono>
      <Mono className="text-[11px] text-zinc-600">{time}</Mono>
    </motion.div>
  )
}

function AgentConversation({ onIntent, onAutoAuthorize }: { onIntent?: (intentData: any) => void; onAutoAuthorize?: () => void }) {
  const defaultMessages = [
    { role: "assistant", content: "Hello! I am the Aegis AI Revenue Agent. What kind of environment or setup do you need today?" }
  ];
  const [messages, setMessages] = useState<any[]>(defaultMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('agentChatHistory');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (messages.length > 1) {
      localStorage.setItem('agentChatHistory', JSON.stringify(messages));
    }
  }, [messages]);

  const clearHistory = () => {
    setMessages(defaultMessages);
    localStorage.removeItem('agentChatHistory');
    inputRef.current?.focus();
  };



  const onSubmit = async (e: any) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userText = input.trim();
    const msg = { role: "user", content: userText };
    setInput("");
    
    const newMessages = [...messages, msg];
    setMessages(newMessages);
    setIsLoading(true);
    
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, history: messages }),
      });
      const data = await res.json();
      console.log("[AgentChat] LLM response keys:", Object.keys(data), "| toolCalls:", data.toolCalls);
      
      let finalMessages = [...newMessages, { ...data, rawToolCalls: data.rawToolCalls }];
      setMessages(finalMessages);
      
      let purchaseIntentData = null;

      // Extract tool calls for UI and check if LLM initiated a purchase
      if (data.toolCalls && data.toolCalls.length > 0) {
        for (const tc of data.toolCalls) {
          if (tc.name === 'initiate_purchase' && tc.result?.success) {
            purchaseIntentData = tc.result;
          }
        }
      }
      
      // If the LLM successfully created a transaction, trigger the Trust Layer evaluation panel
      if (purchaseIntentData) {
        onIntent?.(purchaseIntentData);
        onAutoAuthorize?.();
      }
      
    } catch (e) {
      console.error("[AgentChat] Error:", e);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  return (
    <section className="flex flex-col h-[650px] rounded-xl border border-white/[0.08] bg-white/[0.02]">
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <StatusDot />
          <span className="text-sm font-medium text-zinc-100">AI Revenue Agent</span>
          <span className="text-xs text-emerald-300">Online</span>
        </div>
        <Mono className="text-[11px] uppercase tracking-wider text-zinc-500">AGENT_7F92A1</Mono>
      </div>

      <motion.div
        initial="initial"
        animate="animate"
        transition={{ staggerChildren: 0.18 }}
        className="flex flex-col gap-4 p-4 md:p-5 overflow-y-auto flex-1 scrollbar-thin"
      >
        {messages.length === 1 && (
          <div className="flex justify-center my-4">
             <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-zinc-500 font-mono tracking-wider uppercase">Conversation Started</span>
          </div>
        )}
        {messages.map((m, i) => {
          if (m.role === "user") {
            return <CustomerBubble key={i}>{m.content}</CustomerBubble>
          } else {
            return (
              <div key={i} className="flex flex-col gap-3">
                <AgentMessage>{m.content}</AgentMessage>
                {m.toolCalls?.map((t: any, j: number) => {
                  if (t.name === 'search_catalog' && t.result?.data) {
                     return (
                       <div key={j} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pl-2">
                         {t.result.data.map((p: any, k: number) => (
                           <ProductCard key={k} product={{
                             id: p.id,
                             name: p.name,
                             price: p.price_paise / 100,
                             kind: p.metadata?.is_upsell ? "recommendation" : "base",
                             blurb: p.description,
                             icon: p.metadata?.is_upsell ? Cpu : Sparkles
                           }} delay={0} />
                         ))}
                       </div>
                     )
                  }
                  return null;
                })}
              </div>
            )
          }
        })}
        {isLoading && (
          <div className="flex justify-start">
             <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
               <Loader className="w-4 h-4 animate-spin" /> Thinking...
             </div>
          </div>
        )}
      </motion.div>

      <div className="shrink-0 border-t border-white/[0.08] p-4">
        <form onSubmit={onSubmit} className="flex gap-2 relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Type your prompt..."
            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 pr-24"
          />
          <div className="absolute right-1.5 top-1.5 flex gap-1">
            <button type="button" onClick={clearHistory} className="rounded-md bg-zinc-500/15 border border-zinc-500/40 px-3 py-1.5 text-zinc-400 hover:bg-zinc-500/25 transition-colors" title="Clear chat history">
              <Trash className="w-4 h-4" />
            </button>
            <button type="submit" disabled={isLoading || !input.trim()} className="rounded-md bg-emerald-500/15 border border-emerald-500/40 px-3 py-1.5 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors">
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Trust evaluation panel                                                     */
/* -------------------------------------------------------------------------- */

type FlowState = "idle" | "evaluating" | "authorized" | "denied"

function TrustCheckRow({
  index,
  active,
}: {
  index: number
  active: boolean
}) {
  const check = TRUST_CHECKS[index]
  const Icon = check.icon
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={active ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-3 rounded-md border border-emerald-500/10 bg-emerald-500/[0.03] px-3 py-2"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_10px] shadow-emerald-500/30">
        <Check className="h-3 w-3 text-emerald-400" strokeWidth={3} />
      </span>
      <Icon className="h-3.5 w-3.5 text-zinc-500" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-zinc-200">{check.label}</div>
        <Mono className="text-[10px] text-zinc-500">{check.event}</Mono>
      </div>
    </motion.div>
  )
}

function LifecycleTrack({ denied, isCaptured }: { denied: boolean, isCaptured?: boolean }) {
  const states = ["Proposed", "Authorized", "Reserved", "Payment_Pending", "Captured"]
  // In success flow: first three active, payment pending waiting, captured inactive (unless isCaptured).
  const activeCount = denied ? 1 : (isCaptured ? 5 : 3)
  return (
    <div className="rounded-lg border border-white/[0.08] bg-black/30 p-3">
      <Kicker>Transaction Lifecycle</Kicker>
      <div className="mt-3 flex flex-col gap-0">
        {states.map((s, i) => {
          const active = i < activeCount
          const isPaymentPending = i === 3 && !isCaptured
          const isCurrentState = isCaptured ? (i === 4) : (i === 2)
          const denyStop = denied && i === 1
          return (
            <div key={s} className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border text-[8px] ${
                    active
                      ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                      : denyStop
                      ? "border-red-500/40 bg-red-500/20 text-red-400"
                      : isPaymentPending && !denied
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                      : "border-white/10 bg-white/[0.02] text-zinc-600"
                  }`}
                >
                  {active ? <Check className="h-2 w-2" strokeWidth={3} /> : denyStop ? "×" : ""}
                </span>
                {i < states.length - 1 && (
                  <span
                    className={`my-0.5 h-4 w-px ${
                      i < activeCount - 1 ? "bg-emerald-500/30" : "bg-white/10"
                    }`}
                  />
                )}
              </div>
              <div className="flex flex-1 items-center justify-between py-0.5">
                <Mono
                  className={`text-[11px] uppercase tracking-wider ${
                    active
                      ? "text-emerald-300"
                      : denyStop
                      ? "text-red-300"
                      : isPaymentPending && !denied
                      ? "text-amber-300"
                      : "text-zinc-600"
                  }`}
                >
                  {s}
                </Mono>
                {isPaymentPending && !denied && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-amber-400/80">
                    Waiting for payment
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AuthorizedResult({ intentData, onReset }: { intentData?: any, onReset: () => void }) {
  const [paymentState, setPaymentState] = useState<"pending" | "processing" | "success" | "failed">("pending");
  
  const intents = intentData?.intents || (intentData?.product ? [intentData] : []);
  
  // Calculate total amount
  let totalPaise = 0;
  for (const intent of intents) {
     totalPaise += intent.transaction?.amount_paise || intent.product?.price_paise || 0;
  }
  const amount = totalPaise / 100;
  
  const handlePayment = async () => {
    // If there is only one intent and it has an order_id, we can pass it to Razorpay.
    // If there are multiple, Razorpay doesn't support multiple order IDs, so we omit it
    // in test mode to allow a combined payment capture.
    const orderId = intents.length === 1 ? intents[0].order?.gateway_order_id : undefined;
    
    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TVXVHmyhz0YFD6",
      amount: totalPaise,
      currency: "INR",
      name: "Aegis Commerce",
      description: "AI Autonomous Purchase",
      ...(orderId && { order_id: orderId }),
      handler: async function (response: any) {
          setPaymentState("processing");
          try {
            // Execute capture for all intents concurrently
            const capturePromises = intents.map(async (intent: any) => {
              if (!intent.transaction?.id) return { success: false, error: "No transaction ID" };
              const res = await fetch("/api/capture", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                  transaction_id: intent.transaction.id,
                  payment_id: response.razorpay_payment_id || "pay_simulated_" + Date.now()
                })
              });
              return await res.json();
            });

            const results = await Promise.all(capturePromises);
            
            const hasFailure = results.some(r => !r.success);
            if (hasFailure) {
              alert("Backend capture failed for one or more items.");
              setPaymentState("failed");
            } else {
              setPaymentState("success");
            }
          } catch(e) {
            alert("Error communicating with backend capture");
            setPaymentState("failed");
          }
      },
      prefill: {
          name: "Customer",
          email: "customer@example.com",
          contact: "9999999999"
      },
      theme: {
          color: "#10b981" // Emerald
      }
    };
    
    const rzp = new (window as any).Razorpay(options);
    rzp.on('payment.failed', function (response: any) {
        setPaymentState("failed");
        alert("Payment failed: " + response.error.description);
    });
    rzp.open();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="flex flex-col gap-4"
    >
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] p-5 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 shadow-[0_0_30px] shadow-emerald-500/30"
        >
          <Check className="h-6 w-6 text-emerald-400" strokeWidth={2.5} />
        </motion.div>
        <div className="mt-3 text-lg font-semibold tracking-tight text-emerald-300">AUTHORIZED</div>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-400/70">
          Ready for Checkout
        </div>
        <p className="mt-3 text-sm text-zinc-300">
          <Mono className="font-semibold text-zinc-50">{inr(amount)}</Mono> approved against Agent Grant
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.06]">
        <div className="bg-[#080808] p-3">
          <Kicker>Transactions</Kicker>
          <Mono className="mt-1 block text-xs text-zinc-200 truncate">
            {intents.length} item{intents.length > 1 ? 's' : ''}
          </Mono>
        </div>
        <div className="bg-[#080808] p-3">
          <Kicker>State</Kicker>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <Mono className="text-xs text-emerald-300">AUTHORIZED</Mono>
          </div>
        </div>
      </div>

      <div className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
        paymentState === "success" 
          ? "border-emerald-500/20 bg-emerald-500/[0.05]" 
          : "border-amber-500/20 bg-amber-500/[0.05]"
      }`}>
        <div>
          <Kicker>{paymentState === "success" ? "Final State" : "Next Step"}</Kicker>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-zinc-200">
            {paymentState === "success" ? (
              <CircleCheck className="h-4 w-4 text-emerald-400" />
            ) : (
              <Wallet className="h-3.5 w-3.5 text-amber-400" />
            )}
            {paymentState === "success" ? "Payment Completed" : "Razorpay checkout"}
          </div>
        </div>
        
        {paymentState === "pending" || paymentState === "failed" ? (
          <button onClick={handlePayment} className="font-mono text-[10px] uppercase tracking-[0.14em] bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 rounded transition-colors font-bold">
            {paymentState === "failed" ? "Retry Payment" : "Pay Now"}
          </button>
        ) : paymentState === "processing" ? (
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
            <Loader className="h-3 w-3 animate-spin" /> Verifying...
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded">
            Settled & Captured
          </span>
        )}
      </div>

      <p className="text-center text-[11px] leading-relaxed text-zinc-500">
        Authorization <span className="text-zinc-300">≠</span> Payment. Aegis reserves funds
        deterministically before the payment webhook confirms settlement.
      </p>

      <LifecycleTrack denied={false} isCaptured={paymentState === "success"} />
      
      <button
        onClick={onReset}
        className="mt-4 w-full rounded-lg border border-white/[0.08] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-200"
      >
        Reset Demo
      </button>
    </motion.div>
  )
}

function DeniedResult({ intentData, grant }: { intentData?: any; grant?: any }) {
  const amountPaise = intentData?.transaction?.amount_paise || intentData?.product?.price_paise || 0;
  const maxLimit = grant?.max_amount || 100000;
  const consumed = grant?.consumed || 0;

  const rows = [
    { label: "Requested", value: inr(amountPaise / 100), tone: "text-red-300" },
    { label: "Authorized", value: inr(maxLimit / 100), tone: "text-zinc-300" },
    { label: "Funds reserved", value: inr(consumed / 100), tone: "text-zinc-300" },
    { label: "Payment", value: "NOT CREATED", tone: "text-zinc-300" },
  ]
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-4"
    >
      <div className="rounded-xl border border-red-500/25 bg-red-500/[0.05] p-5 text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-red-500/40 bg-red-500/15 shadow-[0_0_30px] shadow-red-500/25"
        >
          <Ban className="h-6 w-6 text-red-400" strokeWidth={2} />
        </motion.div>
        <div className="mt-3 text-lg font-semibold tracking-tight text-red-300">DENIED</div>
        <div className="mt-1 flex items-center justify-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-red-400/80">
          <TriangleAlert className="h-3 w-3" />
          Spending Limit Exceeded
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/[0.08]">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={`flex items-center justify-between px-4 py-2.5 ${
              i !== rows.length - 1 ? "border-b border-white/[0.06]" : ""
            } bg-white/[0.02]`}
          >
            <Kicker>{r.label}</Kicker>
            <Mono className={`text-sm ${r.tone}`}>{r.value}</Mono>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3">
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
        <p className="text-xs leading-relaxed text-zinc-400">
          The AI attempted to spend beyond its grant. Aegis rejected the transaction deterministically —
          <span className="text-zinc-200"> the agent cannot bypass the Trust Layer.</span>
        </p>
      </div>

      <LifecycleTrack denied />
    </motion.div>
  )
}

function PurchaseIntentPanel({
  flow,
  completedChecks,
  onAuthorize,
  onSimulateFailure,
  onReset,
  intentData,
}: {
  flow: FlowState
  completedChecks: number
  onAuthorize: () => void
  onSimulateFailure: () => void
  onReset: () => void
  intentData?: any
}) {
  const [grant, setGrant] = useState<any>(null);

  useEffect(() => {
    fetch("/api/grant")
      .then(r => r.json())
      .then(d => setGrant(d))
      .catch(console.error);
  }, []);

  const intents = intentData?.intents || (intentData?.product ? [intentData] : []);
  
  let totalPaise = 0;
  for (const intent of intents) {
     totalPaise += intent.transaction?.amount_paise || intent.product?.price_paise || 0;
  }
  const tot = totalPaise + (grant?.consumed || 0);
  const total = totalPaise ? totalPaise / 100 : 0;
  
  // Prioritize transaction metadata snapshot, then fetched grant, then fallback
  const firstIntent = intents[0];
  const backendTx = firstIntent?.proposal?.data || firstIntent?.proposal;
  const grantSnapshotMax = backendTx?.metadata?.grant_snapshot?.max_amount_paise;
  const maxLimit = grantSnapshotMax 
    ? grantSnapshotMax / 100 
    : (grant?.max_amount ? grant.max_amount / 100 : META.authMax);
    
  const pct = Math.min(100, (total / maxLimit) * 100)
  
  const displayedProducts = intents.map((i: any) => ({
      id: i.product?.id,
      name: i.product?.name,
      price: (i.transaction?.amount_paise || i.product?.price_paise || 0) / 100,
      kind: 'base'
  }));

  return (
    <div className="lg:sticky lg:top-6">
      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl">
        {/* header */}
        <div className="border-b border-white/[0.08] px-4 py-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-zinc-400" strokeWidth={1.75} />
            <span className="text-sm font-semibold tracking-tight text-zinc-100">Purchase Intent</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            AI-proposed transaction awaiting Trust Layer authorization.
          </p>
        </div>

        {/* grant meta */}
        <div className="grid grid-cols-3 gap-px border-b border-white/[0.08] bg-white/[0.06]">
          {[
            { k: "Agent", v: intentData?.proposal?.data?.agent_id?.split('-')[0] + '...' || META.agent },
            { k: "Grant", v: grant?.id?.split('-')[0] + '...' || META.grant },
            { k: "Maximum", v: inr(maxLimit) },
          ].map((m) => (
            <div key={m.k} className="bg-[#080808] p-3">
              <Kicker>{m.k}</Kicker>
              <Mono className="mt-1 block truncate text-[11px] text-zinc-300">{m.v}</Mono>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 p-4">
          {/* line items */}
          <div>
            <Kicker>Line Items</Kicker>
            <div className="mt-2 flex flex-col gap-1.5">
              {displayedProducts.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-zinc-300">
                    <Sparkles className="h-3 w-3 text-emerald-400" />
                    {p.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* totals */}
          <div className="rounded-lg border border-white/[0.08] bg-black/30 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Base purchase</span>
              <Mono className="text-zinc-300">{inr(total)}</Mono>
            </div>
            {intents[0]?.order && (
              <div className="mt-3 border-t border-white/[0.08] pt-3">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Razorpay Order IDs</span>
                <Mono className="text-xs text-emerald-400 break-all">{intents.map((i: any) => i.order?.gateway_order_id).join(', ')}</Mono>
              </div>
            )}
            <div className="mt-3 flex items-end justify-between border-t border-white/[0.08] pt-3">
              <span className="text-sm text-zinc-400">Total Authorized</span>
              <Mono className="text-3xl font-semibold tracking-tight text-zinc-50">{inr(total)}</Mono>
            </div>

            {/* authorization progress */}
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-300">
                  Within Authorization Limit
                </span>
                <Mono className="text-[10px] text-zinc-400">
                  {inr(total)} / {inr(maxLimit)}
                </Mono>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="h-full rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/50"
                />
              </div>
            </div>
          </div>

          {/* AI proposes / Aegis decides */}
          <div className="flex items-stretch gap-2">
            <div className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-center">
              <Kicker>AI Proposed</Kicker>
              <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-zinc-400">
                <Sparkles className="h-3 w-3 text-zinc-500" /> Probabilistic
              </div>
            </div>
            <div className="flex items-center text-zinc-600">
              <ArrowRight className="h-4 w-4" />
            </div>
            <div className="flex-1 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2.5 text-center">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-300">
                Aegis Must Authorize
              </span>
              <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-emerald-300/80">
                <ShieldCheck className="h-3 w-3" /> Deterministic
              </div>
            </div>
          </div>

          {/* action zone */}
          <AnimatePresence mode="wait">
            {flow === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-2"
              >
                <button
                  onClick={onAuthorize}
                  className="group relative flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-3.5 text-sm font-semibold text-emerald-200 shadow-[0_0_24px] shadow-emerald-500/20 transition-all hover:bg-emerald-500/25 hover:shadow-emerald-500/40"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Authorize Purchase
                </button>
                <button
                  onClick={onSimulateFailure}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-transparent px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:border-red-500/30 hover:text-red-300"
                >
                  <TriangleAlert className="h-3 w-3" />
                  Simulate Policy Failure
                </button>
              </motion.div>
            )}

            {flow === "evaluating" && (
              <motion.div
                key="evaluating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-3"
              >
                <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3.5 text-sm font-semibold text-emerald-200">
                  <Loader className="h-4 w-4 animate-spin" />
                  Evaluating Trust...
                </div>
                <div className="flex flex-col gap-1.5">
                  {TRUST_CHECKS.map((c, i) => (
                    <div key={c.id}>
                      {i < completedChecks ? (
                        <TrustCheckRow index={i} active />
                      ) : (
                        <div className="flex items-center gap-3 rounded-md border border-white/[0.06] bg-white/[0.01] px-3 py-2 opacity-50">
                          <span className="h-5 w-5 rounded-full border border-white/10" />
                          <Mono className="text-[10px] text-zinc-600">{c.event}</Mono>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {flow === "authorized" && (
              <motion.div key="authorized" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AuthorizedResult intentData={intentData} onReset={onReset} />
              </motion.div>
            )}

            {flow === "denied" && (
              <motion.div key="denied" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <DeniedResult intentData={intentData} grant={grant} />
                <button
                  onClick={onReset}
                  className="mt-4 w-full rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-emerald-300 transition-colors hover:bg-emerald-500/10"
                >
                  Reset to ₹998 Flow
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* footer metadata */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/[0.08] px-4 py-3">
          {[
            ["Idempotency", intentData?.intents?.[0]?.proposal?.data?.idempotency_key?.split('_')[1]?.substring(0, 8) + "..." || META.idempotency],
            ["Catalog hash", intentData?.intents?.[0]?.product?.content_hash?.substring(0, 12) + "..." || META.catalogHash],
            ["Currency", intentData?.intents?.[0]?.transaction?.currency || META.currency],
            ["Environment", META.environment],
            ["Policy", "strict_limit"],
            ["Authorization", grant?.id?.split('-')[0] + "..." || META.grant],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <Kicker>{k}</Kicker>
              <Mono className="truncate text-[10px] text-zinc-500">{v}</Mono>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export function AIAgentView() {
  const [flow, setFlow] = useState<FlowState>("idle")
  const [completedChecks, setCompletedChecks] = useState(0)
  const [intentData, setIntentData] = useState<any>(null)
  
  const [dashboardData, setDashboardData] = useState<any>({ transactions: [] })

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', {
        headers: {
          'X-Agent-ID': '22222222-2222-2222-2222-222222222222'
        }
      })
      if (res.ok) {
        const data = await res.json()
        setDashboardData(data)
      }
    } catch (e) {
      console.error('Failed to fetch dashboard data:', e)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
    const interval = window.setInterval(fetchDashboard, 5000)
    return () => window.clearInterval(interval)
  }, [fetchDashboard])

  const runTrustEvaluation = useCallback(() => {
    setFlow("evaluating")
    setCompletedChecks(0)
    // Reveal checks quickly, like terminal execution.
    TRUST_CHECKS.forEach((_, i) => {
      setTimeout(() => setCompletedChecks(i + 1), 260 * (i + 1))
    })
    setTimeout(() => setFlow("authorized"), 260 * (TRUST_CHECKS.length + 1) + 200)
  }, [])

  const simulateFailure = useCallback(() => setFlow("denied"), [])

  const reset = useCallback(() => {
    setFlow("idle")
    setCompletedChecks(0)
    setIntentData(null)
  }, [])

  const statement = useMemo(
    () => (
      <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
        <span className="text-zinc-400">AI proposes.</span>
        <span className="font-semibold text-emerald-400">Aegis decides.</span>
      </div>
    ),
    [],
  )

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-50 font-sans selection:bg-emerald-500/20">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <PageHeader />
      <RevenueBar data={dashboardData} />

      <div className="mx-auto max-w-[1440px] px-5 py-6 md:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <AgentConversation onIntent={setIntentData} onAutoAuthorize={runTrustEvaluation} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="h-full"
          >
            {intentData ? (
              <PurchaseIntentPanel
                flow={flow}
                completedChecks={completedChecks}
                onAuthorize={runTrustEvaluation}
                onSimulateFailure={simulateFailure}
                onReset={reset}
                intentData={intentData}
              />
            ) : (
              <GrantSettingsPanel />
            )}
          </motion.div>
        </div>
      </div>

      {/* signature statement */}
      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-2 px-5 py-8 text-center md:px-8">
          <div className="text-lg font-semibold tracking-tight md:text-xl">{statement}</div>
          <p className="max-w-md text-xs leading-relaxed text-zinc-600">
            The AI is probabilistic and untrusted. The Aegis Trust Layer is deterministic and controls
            every financial execution.
          </p>
        </div>
      </footer>
    </main>
  )
}

function GrantSettingsPanel() {
  const [grant, setGrant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newLimit, setNewLimit] = useState("");

  const asPaise = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const fetchGrant = async () => {
    try {
      const res = await fetch("/api/grant");
      if (!res.ok) {
        throw new Error(`Failed to load grant: HTTP ${res.status}`);
      }
      const data = await res.json();
      setGrant(data);
      setNewLimit((asPaise(data.max_amount) / 100).toString());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrant();
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      await fetch("/api/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_amount: parseFloat(newLimit) * 100 }),
      });
      await fetchGrant();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <div className="flex h-full min-h-[650px] flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] border-dashed p-8 text-center">
      <Loader className="mb-4 h-8 w-8 text-zinc-600 animate-spin" strokeWidth={1.5} />
    </div>
  );

  const consumed = asPaise(grant?.consumed);
  const reserved = asPaise(grant?.reserved);

  return (
    <div className="flex h-full min-h-[650px] flex-col rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
      <div className="mb-6 border-b border-white/[0.08] pb-4">
        <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-400" />
          Trust Layer Settings
        </h3>
        <p className="mt-1 text-sm text-zinc-400">Configure your autonomous commerce authorization grant.</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-white/[0.06] bg-black/40 p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Consumed</div>
            <div className="text-2xl font-mono text-emerald-400">{inr(consumed / 100)}</div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/40 p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Reserved</div>
            <div className="text-2xl font-mono text-amber-400">{inr(reserved / 100)}</div>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-5">
          <label className="block text-sm font-medium text-emerald-200 mb-2">Maximum Grant Limit (₹)</label>
          <div className="flex gap-3">
            <input 
              type="number"
              value={newLimit}
              onChange={e => setNewLimit(e.target.value)}
              className="flex-1 rounded-md border border-emerald-500/30 bg-black/50 px-3 py-2 text-emerald-100 focus:border-emerald-500 focus:outline-none"
            />
            <button 
              onClick={handleUpdate}
              disabled={updating}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {updating ? "Updating..." : "Update Limit"}
            </button>
          </div>
          <p className="mt-2 text-xs text-emerald-500/70">
            The Agent cannot exceed this strict limit across all cumulative transactions.
          </p>
        </div>
        
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] border-dashed p-8 text-center mt-8">
          <Wallet className="mx-auto mb-4 h-8 w-8 text-zinc-600" strokeWidth={1.5} />
          <h3 className="text-sm font-medium text-zinc-300">Awaiting Purchase Intent</h3>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            The Trust Layer is on standby. When the AI Revenue Agent proposes a transaction, it will appear here for your deterministic authorization.
          </p>
        </div>
      </div>
    </div>
  );
}
