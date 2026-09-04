export type TxStatus =
  | 'captured'
  | 'payment_pending'
  | 'failed'
  | 'authorized'
  | 'released'

export type PolicyDecision = 'allowed' | 'denied'

export type LifecycleStage =
  | 'PROPOSED'
  | 'AUTHORIZED'
  | 'RESERVED'
  | 'PAYMENT_PENDING'
  | 'CAPTURED'
  | 'RELEASED'
  | 'FAILED'

export interface Transaction {
  id: string
  shortId: string
  agent: string
  product: string
  amountPaise: number
  currency: string
  policy: PolicyDecision
  policyReason: string
  status: TxStatus
  createdAt: string // ISO
  updatedAt: string // ISO
  createdLabel: string
  grantLimitPaise: number
  grantRemainingPaise: number
  reservedPaise: number
  gatewayOrderId: string | null
  catalogVerified: boolean
  idempotencyOk: boolean
  lifecycle: LifecycleStage[]
}

export interface AuditEvent {
  id: string
  ts: string
  time: string
  type: string
  resource: string
  transactionId: string
  agent: string
  hash: string
  payload: Record<string, unknown>
  severity: 'info' | 'warn' | 'deny'
}

export const PRODUCTS = [
  'Premium AI Subscription',
  'Compute Credits',
  'Vector Database Credits',
  'LLM API Credits',
  'GPU Compute Package',
  'Enterprise AI Workspace',
  'Embedding Credits',
  'Cloud Storage',
  'AI Agent Pro Plan',
  'Inference Credits',
]

export const AGENTS = ['agent_7f92a1', 'agent_91ac4e', 'agent_c12b77', 'agent_44de21']

export function inr(paise: number): string {
  const rupees = paise / 100
  return '₹' + rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function hash(seed: string): string {
  // deterministic pseudo sha256-ish hex string
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let out = ''
  let x = h >>> 0
  for (let i = 0; i < 16; i++) {
    x = Math.imul(x ^ (x >>> 15), 2246822519)
    x = (x ^ (x >>> 13)) >>> 0
    out += (x % 16).toString(16)
  }
  return out
}

export function fullHash(seed: string): string {
  return hash(seed) + hash(seed + '::1') + hash(seed + '::2') + hash(seed + '::3')
}

const LIFECYCLE_BY_STATUS: Record<TxStatus, LifecycleStage[]> = {
  captured: ['PROPOSED', 'AUTHORIZED', 'RESERVED', 'PAYMENT_PENDING', 'CAPTURED'],
  payment_pending: ['PROPOSED', 'AUTHORIZED', 'RESERVED', 'PAYMENT_PENDING'],
  failed: ['PROPOSED', 'AUTHORIZED', 'RESERVED', 'PAYMENT_PENDING', 'FAILED'],
  authorized: ['PROPOSED', 'AUTHORIZED'],
  released: ['PROPOSED', 'AUTHORIZED', 'RESERVED', 'RELEASED'],
}

interface Seed {
  short: string
  agent: string
  product: string
  amount: number // rupees
  policy: PolicyDecision
  status: TxStatus
  minsAgo: number
  reason?: string
  catalogVerified?: boolean
  idempotencyOk?: boolean
}

const SEEDS: Seed[] = [
  { short: 'eb26c459', agent: 'agent_998877', product: 'LLM API Credits', amount: 891, policy: 'allowed', status: 'captured', minsAgo: 622 },
  { short: '50644d1e', agent: 'agent_d4e5f6', product: 'Premium AI Subscription', amount: 5866, policy: 'allowed', status: 'captured', minsAgo: 1273 },
  { short: '136996e1', agent: 'agent_7f92a1', product: 'AI Agent Pro Plan', amount: 4557, policy: 'allowed', status: 'captured', minsAgo: 124 },
  { short: '8e8a72b2', agent: 'agent_c12b77', product: 'Quantum Compute Trial', amount: 2327, policy: 'denied', status: 'released', minsAgo: 824, reason: 'idempotency_replay_detected' },
  { short: '1465b9c0', agent: 'agent_112233', product: 'Premium AI Subscription', amount: 5176, policy: 'denied', status: 'released', minsAgo: 464, reason: 'catalog_hash_mismatch' },
  { short: '71832471', agent: 'agent_112233', product: 'Cloud Storage', amount: 6492, policy: 'denied', status: 'released', minsAgo: 1557, reason: 'exceeds_grant_limit' },
  { short: '52974749', agent: 'agent_a9b1c2', product: 'Vector Database Credits', amount: 5569, policy: 'allowed', status: 'captured', minsAgo: 562 },
  { short: 'a2c7d004', agent: 'agent_91ac4e', product: 'Cloud Storage', amount: 1510, policy: 'allowed', status: 'payment_pending', minsAgo: 6 },
  { short: '9b8ebd55', agent: 'agent_91ac4e', product: 'Compute Credits', amount: 1294, policy: 'denied', status: 'released', minsAgo: 1001, reason: 'policy_blocked' },
  { short: 'c9951948', agent: 'agent_7f92a1', product: 'Synthetic Data Gen', amount: 6166, policy: 'allowed', status: 'captured', minsAgo: 381 },
  { short: '21bd928a', agent: 'agent_44de21', product: 'Inference Credits', amount: 6680, policy: 'allowed', status: 'captured', minsAgo: 400 },
  { short: '1459b3c0', agent: 'agent_7f92a1', product: 'Compute Credits', amount: 2754, policy: 'denied', status: 'released', minsAgo: 1002, reason: 'expired_authorization' },
  { short: '8f011273', agent: 'agent_44de21', product: 'Compute Credits', amount: 836, policy: 'allowed', status: 'captured', minsAgo: 553 },
  { short: '68daf9b7', agent: 'agent_d4e5f6', product: 'Premium AI Subscription', amount: 2057, policy: 'allowed', status: 'captured', minsAgo: 297 },
  { short: '16437935', agent: 'agent_c12b77', product: 'Compute Credits', amount: 3885, policy: 'allowed', status: 'authorized', minsAgo: 19 },
  { short: '24f15044', agent: 'agent_112233', product: 'Quantum Compute Trial', amount: 761, policy: 'denied', status: 'released', minsAgo: 1858, reason: 'exceeds_grant_limit' },
  { short: 'b643f49f', agent: 'agent_d4e5f6', product: 'Embedding Credits', amount: 5101, policy: 'allowed', status: 'captured', minsAgo: 877 },
  { short: '7d173de2', agent: 'agent_c12b77', product: 'Inference Credits', amount: 3680, policy: 'allowed', status: 'payment_pending', minsAgo: 7 },
  { short: '0394d35d', agent: 'agent_44de21', product: 'Embedding Credits', amount: 6825, policy: 'allowed', status: 'authorized', minsAgo: 17 },
  { short: 'ee3c6bc7', agent: 'agent_91ac4e', product: 'Vector Database Credits', amount: 2196, policy: 'allowed', status: 'authorized', minsAgo: 29 },
  { short: 'a885c34d', agent: 'agent_44de21', product: 'Synthetic Data Gen', amount: 3741, policy: 'allowed', status: 'authorized', minsAgo: 20 },
  { short: 'd5bfe59d', agent: 'agent_91ac4e', product: 'Inference Credits', amount: 744, policy: 'allowed', status: 'captured', minsAgo: 1820 },
  { short: 'd7ad0fb4', agent: 'agent_998877', product: 'Inference Credits', amount: 6731, policy: 'allowed', status: 'captured', minsAgo: 962 },
  { short: 'ff5eb061', agent: 'agent_998877', product: 'Premium AI Subscription', amount: 5864, policy: 'allowed', status: 'captured', minsAgo: 587 },
  { short: '2e0b63ef', agent: 'agent_d4e5f6', product: 'Compute Credits', amount: 6138, policy: 'allowed', status: 'captured', minsAgo: 1241 },
  { short: 'a46a534b', agent: 'agent_112233', product: 'AI Agent Pro Plan', amount: 4245, policy: 'allowed', status: 'captured', minsAgo: 1332 },
  { short: 'a2018151', agent: 'agent_112233', product: 'Compute Credits', amount: 5151, policy: 'allowed', status: 'captured', minsAgo: 1034 },
  { short: 'f1ec1d73', agent: 'agent_44de21', product: 'Inference Credits', amount: 1279, policy: 'denied', status: 'released', minsAgo: 1382, reason: 'exceeds_grant_limit' },
  { short: '33019f34', agent: 'agent_998877', product: 'Embedding Credits', amount: 5059, policy: 'allowed', status: 'authorized', minsAgo: 17 },
  { short: '0e6bb00b', agent: 'agent_a9b1c2', product: 'Automated DevOps Sandbox', amount: 2037, policy: 'allowed', status: 'captured', minsAgo: 1145 },
  { short: 'cb9019c4', agent: 'agent_44de21', product: 'Premium AI Subscription', amount: 632, policy: 'allowed', status: 'captured', minsAgo: 186 },
  { short: '7da4b12e', agent: 'agent_7f92a1', product: 'Cloud Storage', amount: 5730, policy: 'allowed', status: 'captured', minsAgo: 134 },
  { short: '37c21717', agent: 'agent_112233', product: 'GPU Compute Package', amount: 6604, policy: 'allowed', status: 'captured', minsAgo: 1921 },
  { short: '0ff75201', agent: 'agent_c12b77', product: 'Quantum Compute Trial', amount: 2688, policy: 'allowed', status: 'captured', minsAgo: 431 },
  { short: '4e178965', agent: 'agent_91ac4e', product: 'Automated DevOps Sandbox', amount: 1818, policy: 'denied', status: 'released', minsAgo: 372, reason: 'exceeds_grant_limit' },
  { short: '044a0c36', agent: 'agent_7f92a1', product: 'Vector Database Credits', amount: 4274, policy: 'denied', status: 'released', minsAgo: 1915, reason: 'exceeds_grant_limit' },
  { short: 'bc9feace', agent: 'agent_c12b77', product: 'Synthetic Data Gen', amount: 5398, policy: 'allowed', status: 'captured', minsAgo: 1737 },
  { short: 'ebb057bb', agent: 'agent_44de21', product: 'Enterprise AI Workspace', amount: 3406, policy: 'allowed', status: 'captured', minsAgo: 652 },
  { short: '1b864b82', agent: 'agent_a9b1c2', product: 'Cloud Storage', amount: 5710, policy: 'allowed', status: 'authorized', minsAgo: 11 },
  { short: '49d34697', agent: 'agent_44de21', product: 'Inference Credits', amount: 4514, policy: 'allowed', status: 'captured', minsAgo: 1836 },
  { short: 'e4835b43', agent: 'agent_d4e5f6', product: 'AI Agent Pro Plan', amount: 3132, policy: 'allowed', status: 'authorized', minsAgo: 12 },
  { short: 'c50d0c67', agent: 'agent_c12b77', product: 'AI Agent Pro Plan', amount: 5388, policy: 'allowed', status: 'captured', minsAgo: 28 },
  { short: '8589a1f8', agent: 'agent_7f92a1', product: 'Autonomous Web Crawler', amount: 3747, policy: 'allowed', status: 'payment_pending', minsAgo: 26 },
  { short: 'de475fc0', agent: 'agent_91ac4e', product: 'AI Agent Pro Plan', amount: 5431, policy: 'denied', status: 'released', minsAgo: 244, reason: 'catalog_hash_mismatch' },
  { short: 'f104db33', agent: 'agent_112233', product: 'Quantum Compute Trial', amount: 7957, policy: 'allowed', status: 'captured', minsAgo: 555 },
  { short: '94244f50', agent: 'agent_c12b77', product: 'Vector Database Credits', amount: 7439, policy: 'allowed', status: 'payment_pending', minsAgo: 7 },
  { short: '9e287b74', agent: 'agent_112233', product: 'Synthetic Data Gen', amount: 4188, policy: 'denied', status: 'released', minsAgo: 296, reason: 'expired_authorization' },
  { short: 'f7402538', agent: 'agent_c12b77', product: 'Autonomous Web Crawler', amount: 2112, policy: 'allowed', status: 'captured', minsAgo: 1597 },
  { short: '91516f26', agent: 'agent_c12b77', product: 'Embedding Credits', amount: 6843, policy: 'allowed', status: 'captured', minsAgo: 317 },
  { short: '88a524ac', agent: 'agent_c12b77', product: 'AI Agent Pro Plan', amount: 933, policy: 'allowed', status: 'captured', minsAgo: 1281 },
  { short: '54fc7a38', agent: 'agent_112233', product: 'Autonomous Web Crawler', amount: 2531, policy: 'denied', status: 'released', minsAgo: 1163, reason: 'idempotency_replay_detected' },
  { short: 'aac2ad19', agent: 'agent_998877', product: 'AI Agent Pro Plan', amount: 4166, policy: 'allowed', status: 'captured', minsAgo: 1527 },
  { short: '69ab965a', agent: 'agent_a9b1c2', product: 'Cloud Storage', amount: 7841, policy: 'allowed', status: 'captured', minsAgo: 1664 },
  { short: 'dee65559', agent: 'agent_44de21', product: 'Autonomous Web Crawler', amount: 1552, policy: 'allowed', status: 'failed', minsAgo: 1678, reason: 'gateway_declined' },
  { short: 'b88a540a', agent: 'agent_d4e5f6', product: 'Vector Database Credits', amount: 8088, policy: 'denied', status: 'released', minsAgo: 1165, reason: 'catalog_hash_mismatch' },
  { short: '94c2712b', agent: 'agent_112233', product: 'Cloud Storage', amount: 7368, policy: 'allowed', status: 'captured', minsAgo: 944 },
  { short: '6d619ff0', agent: 'agent_a9b1c2', product: 'Enterprise AI Workspace', amount: 4049, policy: 'allowed', status: 'captured', minsAgo: 1778 },
  { short: '2abb3687', agent: 'agent_112233', product: 'Enterprise AI Workspace', amount: 1536, policy: 'allowed', status: 'captured', minsAgo: 129 },
  { short: 'bd112ac9', agent: 'agent_44de21', product: 'Compute Credits', amount: 4398, policy: 'allowed', status: 'captured', minsAgo: 1352 },
  { short: '1bb2d27a', agent: 'agent_44de21', product: 'Automated DevOps Sandbox', amount: 3696, policy: 'allowed', status: 'payment_pending', minsAgo: 13 },
  { short: '611c9aef', agent: 'agent_a9b1c2', product: 'Compute Credits', amount: 3090, policy: 'allowed', status: 'captured', minsAgo: 1928 },
  { short: '70a5dae9', agent: 'agent_c12b77', product: 'LLM API Credits', amount: 4765, policy: 'allowed', status: 'captured', minsAgo: 540 },
  { short: '78f08f48', agent: 'agent_d4e5f6', product: 'Enterprise AI Workspace', amount: 7320, policy: 'allowed', status: 'captured', minsAgo: 73 },
  { short: '27e67b8f', agent: 'agent_a9b1c2', product: 'GPU Compute Package', amount: 669, policy: 'allowed', status: 'captured', minsAgo: 1486 },
  { short: 'b9cea12d', agent: 'agent_44de21', product: 'Inference Credits', amount: 7841, policy: 'denied', status: 'released', minsAgo: 517, reason: 'idempotency_replay_detected' },
  { short: 'afa108a4', agent: 'agent_91ac4e', product: 'Embedding Credits', amount: 2940, policy: 'denied', status: 'released', minsAgo: 344, reason: 'catalog_hash_mismatch' },
  { short: 'e76e4a82', agent: 'agent_c12b77', product: 'AI Agent Pro Plan', amount: 776, policy: 'allowed', status: 'captured', minsAgo: 995 },
  { short: '08dd852f', agent: 'agent_112233', product: 'Autonomous Web Crawler', amount: 3115, policy: 'allowed', status: 'captured', minsAgo: 1229 },
  { short: '8a90c5de', agent: 'agent_7f92a1', product: 'Autonomous Web Crawler', amount: 5714, policy: 'allowed', status: 'captured', minsAgo: 670 },
  { short: '73dd47c5', agent: 'agent_91ac4e', product: 'Embedding Credits', amount: 3059, policy: 'allowed', status: 'captured', minsAgo: 1351 },
  { short: '68c5ea7c', agent: 'agent_91ac4e', product: 'Synthetic Data Gen', amount: 4895, policy: 'denied', status: 'released', minsAgo: 1595, reason: 'policy_blocked' },
  { short: '3bd9d435', agent: 'agent_7f92a1', product: 'Embedding Credits', amount: 3281, policy: 'allowed', status: 'payment_pending', minsAgo: 12 },
  { short: '5f9e670c', agent: 'agent_112233', product: 'Synthetic Data Gen', amount: 7447, policy: 'allowed', status: 'captured', minsAgo: 1367 },
  { short: 'c324ff5f', agent: 'agent_d4e5f6', product: 'LLM API Credits', amount: 7941, policy: 'allowed', status: 'captured', minsAgo: 1154 },
  { short: 'd2f1ada6', agent: 'agent_d4e5f6', product: 'Vector Database Credits', amount: 5503, policy: 'allowed', status: 'payment_pending', minsAgo: 8 },
]

const GRANT_BY_AGENT: Record<string, number> = {
  agent_7f92a1: 15000,
  agent_91ac4e: 20000,
  agent_c12b77: 35000,
  agent_44de21: 25000,
  agent_a9b1c2: 50000,
  agent_d4e5f6: 10000,
  agent_112233: 80000,
  agent_998877: 12000,
}

function relLabel(mins: number): string {
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const NOW = new Date('2026-09-02T12:41:02Z').getTime()

export const TRANSACTIONS: Transaction[] = SEEDS.map((s) => {
  const created = new Date(NOW - s.minsAgo * 60_000)
  const updated = new Date(NOW - Math.max(0, s.minsAgo - 1) * 60_000)
  const grantLimit = GRANT_BY_AGENT[s.agent] ?? 1000
  const reserved = s.policy === 'allowed' ? s.amount : 0
  return {
    id: `txn_${s.short}${hash(s.short).slice(0, 6)}`,
    shortId: s.short,
    agent: s.agent,
    product: s.product,
    amountPaise: s.amount * 100,
    currency: 'INR',
    policy: s.policy,
    policyReason: s.reason ?? 'within_grant_limit',
    status: s.status,
    createdAt: created.toISOString(),
    updatedAt: updated.toISOString(),
    createdLabel: relLabel(s.minsAgo),
    grantLimitPaise: grantLimit * 100,
    grantRemainingPaise: Math.max(0, (grantLimit - s.amount)) * 100,
    reservedPaise: reserved * 100,
    gatewayOrderId:
      s.status === 'authorized' || s.policy === 'denied'
        ? null
        : `order_${hash(s.short + 'gw').slice(0, 12)}`,
    catalogVerified: s.catalogVerified ?? true,
    idempotencyOk: s.idempotencyOk ?? true,
    lifecycle: LIFECYCLE_BY_STATUS[s.status],
  }
})

export const LATEST_DECISION = TRANSACTIONS[0]

// ---- Metrics ----
const authorizedVolume = TRANSACTIONS.filter((t) => t.policy === 'allowed').reduce(
  (a, t) => a + t.amountPaise,
  0,
)
const reservedFunds = TRANSACTIONS.filter(
  (t) => t.status === 'payment_pending' || t.status === 'authorized',
).reduce((a, t) => a + t.reservedPaise + (t.status === 'authorized' ? t.amountPaise : 0), 0)
const policyDenials = TRANSACTIONS.filter((t) => t.policy === 'denied').length

export const METRICS = {
  authorizedVolume: authorizedVolume + 452900000,
  reservedFunds: reservedFunds + 8500000,
  policyDenials: policyDenials + 142,
  activeGrants: 48,
}

// ---- Chart data ----
export const HOURLY_VOLUME = [
  { t: '00:00', volume: 1200, denied: 0 },
  { t: '02:00', volume: 800, denied: 100 },
  { t: '04:00', volume: 400, denied: 0 },
  { t: '06:00', volume: 900, denied: 0 },
  { t: '08:00', volume: 2100, denied: 250 },
  { t: '10:00', volume: 3400, denied: 0 },
  { t: '12:00', volume: 4200, denied: 500 },
  { t: '14:00', volume: 3800, denied: 250 },
  { t: '16:00', volume: 5100, denied: 0 },
  { t: '18:00', volume: 4600, denied: 500 },
  { t: '20:00', volume: 3900, denied: 250 },
  { t: '22:00', volume: 2800, denied: 0 },
  { t: 'now', volume: 4200, denied: 250 },
]

// ---- Activity feed ----
export const ACTIVITY = [
  { time: '12:41:02', event: 'payment.captured', amount: '₹500', agent: 'agent_7f92', tone: 'success' as const },
  { time: '12:38:19', event: 'purchase.proposed', amount: '₹500', agent: 'agent_7f92', tone: 'info' as const },
  { time: '12:35:44', event: 'authorization.reserved', amount: '₹999', agent: 'agent_91ac', tone: 'warning' as const },
  { time: '12:31:04', event: 'policy_evaluation_denied', amount: '₹2,500', agent: 'agent_91ac', tone: 'danger' as const },
  { time: '12:27:51', event: 'payment.captured', amount: '₹299', agent: 'agent_91ac', tone: 'success' as const },
  { time: '12:22:10', event: 'authorization.released', amount: '₹5,000', agent: 'agent_c12b', tone: 'neutral' as const },
]

// ---- Pipeline ----
export interface PipelineStage {
  key: string
  label: string
  desc: string
}

export const PIPELINE: PipelineStage[] = [
  { key: 'agent', label: 'AI Agent', desc: 'Autonomous purchase intent' },
  { key: 'policy', label: 'Policy Engine', desc: 'Spend rules evaluated' },
  { key: 'auth', label: 'Authorization', desc: 'Grant + limits verified' },
  { key: 'catalog', label: 'Catalog Integrity', desc: 'Price hash verified' },
  { key: 'reserve', label: 'Atomic Reservation', desc: 'Funds locked in PG' },
  { key: 'gateway', label: 'Payment Gateway', desc: 'Order created' },
  { key: 'webhook', label: 'Webhook', desc: 'Result confirmed' },
  { key: 'settle', label: 'Settlement', desc: 'Commit or release' },
]

// ---- Audit events ----
interface AuditSeed {
  time: string
  minsAgo: number
  type: string
  txShort: string
  agent: string
  severity: 'info' | 'warn' | 'deny'
  payload: Record<string, unknown>
}

const AUDIT_SEEDS: AuditSeed[] = [
  {
    time: '12:41:02',
    minsAgo: 2,
    type: 'payment_captured',
    txShort: '8cecbea6',
    agent: 'agent_7f92a1',
    severity: 'info',
    payload: { transaction_id: 'txn_8cecbea6', agent_id: 'agent_7f92a1', amount_paise: 50000, gateway_order: 'order_a17f0d2c', status: 'captured' },
  },
  {
    time: '12:40:55',
    minsAgo: 2,
    type: 'payment_order_created',
    txShort: '8cecbea6',
    agent: 'agent_7f92a1',
    severity: 'info',
    payload: { transaction_id: 'txn_8cecbea6', gateway: 'razorpay', order_id: 'order_a17f0d2c', amount_paise: 50000 },
  },
  {
    time: '12:40:51',
    minsAgo: 2,
    type: 'authorization_reserved',
    txShort: '8cecbea6',
    agent: 'agent_7f92a1',
    severity: 'info',
    payload: { transaction_id: 'txn_8cecbea6', agent_id: 'agent_7f92a1', reserved_paise: 50000, grant_remaining_paise: 50000 },
  },
  {
    time: '12:40:49',
    minsAgo: 2,
    type: 'policy_evaluation_allowed',
    txShort: '8cecbea6',
    agent: 'agent_7f92a1',
    severity: 'info',
    payload: { transaction_id: 'txn_8cecbea6', agent_id: 'agent_7f92a1', amount_paise: 50000, decision: 'allowed', reason: 'within_grant_limit' },
  },
  {
    time: '12:40:48',
    minsAgo: 2,
    type: 'purchase_proposed',
    txShort: '8cecbea6',
    agent: 'agent_7f92a1',
    severity: 'info',
    payload: { transaction_id: 'txn_8cecbea6', agent_id: 'agent_7f92a1', product: 'Premium AI Subscription', amount_paise: 50000 },
  },
  {
    time: '12:31:07',
    minsAgo: 11,
    type: 'authorization_released',
    txShort: 'b42c9e18',
    agent: 'agent_c12b77',
    severity: 'warn',
    payload: { transaction_id: 'txn_b42c9e18', agent_id: 'agent_c12b77', released_paise: 0, reason: 'policy_denied' },
  },
  {
    time: '12:31:04',
    minsAgo: 11,
    type: 'policy_evaluation_denied',
    txShort: 'b42c9e18',
    agent: 'agent_c12b77',
    severity: 'deny',
    payload: { transaction_id: 'txn_b42c9e18', agent_id: 'agent_c12b77', amount_paise: 250000, decision: 'denied', reason: 'exceeds_grant_limit', grant_limit_paise: 300000 },
  },
  {
    time: '12:20:33',
    minsAgo: 24,
    type: 'payment_gateway_failed',
    txShort: '9d55c3aa',
    agent: 'agent_44de21',
    severity: 'warn',
    payload: { transaction_id: 'txn_9d55c3aa', gateway: 'razorpay', reason: 'gateway_declined', amount_paise: 149900 },
  },
  {
    time: '12:00:41',
    minsAgo: 41,
    type: 'policy_evaluation_denied',
    txShort: 'c7710fe9',
    agent: 'agent_c12b77',
    severity: 'deny',
    payload: { transaction_id: 'txn_c7710fe9', agent_id: 'agent_c12b77', decision: 'denied', reason: 'expired_authorization', grant_expires_at: '2026-09-02T09:00:00Z' },
  },
  {
    time: '11:05:12',
    minsAgo: 96,
    type: 'policy_evaluation_denied',
    txShort: '61b8ea3f',
    agent: 'agent_c12b77',
    severity: 'deny',
    payload: { transaction_id: 'txn_61b8ea3f', agent_id: 'agent_c12b77', decision: 'denied', reason: 'idempotency_replay_detected', original_txn: 'txn_7c04ffab' },
  },
  {
    time: '09:40:18',
    minsAgo: 181,
    type: 'policy_evaluation_denied',
    txShort: 'ab5e6612',
    agent: 'agent_91ac4e',
    severity: 'deny',
    payload: { transaction_id: 'txn_ab5e6612', agent_id: 'agent_91ac4e', decision: 'denied', reason: 'catalog_hash_mismatch', expected_hash: '7e9cc133', actual_hash: 'a02fb914' },
  },
]

export const AUDIT_EVENTS: AuditEvent[] = AUDIT_SEEDS.map((s, i) => ({
  id: `evt_${hash(s.type + s.txShort + i).slice(0, 10)}`,
  ts: new Date(NOW - s.minsAgo * 60_000).toISOString(),
  time: s.time,
  type: s.type,
  resource: `txn_${s.txShort}`,
  transactionId: `txn_${s.txShort}`,
  agent: s.agent,
  hash: fullHash(s.type + s.txShort + i),
  payload: s.payload,
  severity: s.severity,
}))

// ---- Security Lab ----
export interface AttackStep {
  cmd: string
  ok?: boolean
}

export interface Attack {
  id: string
  index: number
  name: string
  severity: 'Critical' | 'High' | 'Medium'
  description: string
  defense: string
  defenseLabel: string
  steps: AttackStep[]
  result: string
}

export const ATTACKS: Attack[] = [
  {
    id: 'unauthorized',
    index: 1,
    name: 'Unauthorized Agent',
    severity: 'Critical',
    description: 'Agent attempts to purchase without a valid authorization grant.',
    defense: 'Authorization validation rejects request.',
    defenseLabel: 'Authorization Validation',
    steps: [
      { cmd: 'attack.unauthorized.inject()' },
      { cmd: 'agent.lookup(agent_x0000)' },
      { cmd: 'authorization.grant.resolve()' },
      { cmd: 'no active grant found', ok: false },
      { cmd: 'request rejected', ok: true },
      { cmd: 'funds untouched', ok: true },
    ],
    result: 'Request rejected by authorization layer. No grant, no spend.',
  },
  {
    id: 'expired',
    index: 2,
    name: 'Expired Authorization',
    severity: 'High',
    description: 'Agent attempts to spend using an expired grant.',
    defense: 'Grant expiration check blocks transaction.',
    defenseLabel: 'Grant Expiry Check',
    steps: [
      { cmd: 'attack.expired.replay()' },
      { cmd: 'authorization.grant.load(grant_c12b)' },
      { cmd: 'grant.expires_at = 2026-09-02T09:00:00Z' },
      { cmd: 'now > expires_at → expired', ok: false },
      { cmd: 'request rejected', ok: true },
      { cmd: 'reservation skipped', ok: true },
    ],
    result: 'Expired grant blocked before reservation. No funds locked.',
  },
  {
    id: 'replay',
    index: 3,
    name: 'Replay Attack',
    severity: 'High',
    description: 'Previously authorized transaction is submitted again.',
    defense: 'Idempotency protection rejects duplicate request.',
    defenseLabel: 'Idempotency Layer',
    steps: [
      { cmd: 'attack.replay.inject()' },
      { cmd: 'transaction.lookup(txn_7c04ffab)' },
      { cmd: 'idempotency.validate(key)' },
      { cmd: 'duplicate transaction detected', ok: false },
      { cmd: 'request rejected', ok: true },
      { cmd: 'funds untouched', ok: true },
    ],
    result: 'Replay request rejected by idempotency layer. No double charge.',
  },
  {
    id: 'catalog',
    index: 4,
    name: 'Catalog Poisoning',
    severity: 'Critical',
    description: 'Product metadata or price has been tampered with.',
    defense: 'Catalog integrity / hash verification detects mismatch.',
    defenseLabel: 'Catalog Integrity',
    steps: [
      { cmd: 'attack.catalog.tamper(price)' },
      { cmd: 'catalog.item.load(sku_gpu_pkg)' },
      { cmd: 'catalog.hash.verify()' },
      { cmd: 'expected 7e9cc133 != actual a02fb914', ok: false },
      { cmd: 'integrity violation → rejected', ok: true },
      { cmd: 'order creation aborted', ok: true },
    ],
    result: 'Tampered catalog entry detected via hash mismatch. Order aborted.',
  },
  {
    id: 'overlimit',
    index: 5,
    name: 'Over-Limit Spending',
    severity: 'Critical',
    description: 'Agent attempts to exceed its authorized spending limit.',
    defense: 'Atomic PostgreSQL reservation prevents overspending.',
    defenseLabel: 'Atomic Reservation',
    steps: [
      { cmd: 'attack.overlimit.burst(x8)' },
      { cmd: 'BEGIN; SELECT ... FOR UPDATE' },
      { cmd: 'reserved + amount > grant_limit', ok: false },
      { cmd: 'ROLLBACK', ok: true },
      { cmd: 'concurrent race prevented', ok: true },
      { cmd: 'balance consistent', ok: true },
    ],
    result: 'Atomic row lock rejected the over-limit burst. No overspend possible.',
  },
]
