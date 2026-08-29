# Agentic Commerce Platform — Architecture & Product Plan

**Plan Version:** 1.0
**Last Updated:** 2026-08-28
**Status:** PROJECT RESET COMPLETE — Decisions 001-008 APPROVED. Implementation restarting from clean state.

---

## 0. Document Protocol & Context

> **THIS SECTION IS MANDATORY READING FOR ANY AI ASSISTANT WORKING ON THIS PROJECT.**
> It contains all context required to produce correct, consistent output regardless of which model or session is being used.

### 0.1 What This Document Is

This is the **single source of truth** for the Agentic Commerce Trust Layer project. It contains every approved architectural decision, every constraint, every rule, and every technical specification needed to build the system. No prior conversation context is required — everything is here.

### 0.2 Working Model

The AI assistant is a **technical copilot**, NOT an autonomous coding agent.

**The AI MUST:**
- Explain every important engineering decision before implementation
- Present decisions in the format specified in Section 10.15
- Wait for explicit approval on significant decisions
- Follow the step-by-step workflow in Section 10.17
- Give 1-3 files per implementation step (never 20+ files at once)
- Teach concepts while building (what, why, alternatives, trade-offs, interview explanation)

**The AI MUST NOT:**
- Independently build the project or generate large amounts of code without approval
- Silently make architectural decisions
- Install dependencies without explaining why
- Modify files without explicit instruction
- Skip the PLAN → EXPLAIN → APPROVE → GUIDE → IMPLEMENT → REVIEW workflow
- Respond with "Done, I implemented it" unless explicitly instructed to modify files

**The workflow is:**
```
PLAN → EXPLAIN → USER APPROVES → AI GUIDES → USER IMPLEMENTS → AI REVIEWS
```

The user performs the actual code changes unless they explicitly authorize the AI to make them.

### 0.3 Project Identity

| Field | Value |
|-------|-------|
| **Project** | Agentic Commerce Trust Layer — Merchant-side AI trust infrastructure |
| **Competition** | Razorpay AI Buildathon 2026, Track 01 — AI Growth & Agentic Commerce |
| **Deadline** | September 5, 2026 (application deadline) |
| **Submission** | Public repo + 5-min pitch video + architecture docs |
| **Language** | Go |
| **Database** | PostgreSQL 16 |
| **Cache** | Redis 7 (where justified) |
| **LLM** | Gemini 2.5 Flash (behind provider-agnostic abstraction) |
| **Agent Protocol** | MCP (Model Context Protocol) — Streamable HTTP |
| **Payment Gateway** | Razorpay (test mode) |
| **Frontend** | React (Vite) — display layer only, zero business logic |
| **Architecture** | Modular monolith, Clean Architecture / dependency inversion |
| **Module Name** | `agentic-commerce` |
| **Go Version** | 1.22+ |

### 0.4 Product Thesis (One Sentence)

> **"Make merchants trustworthy and transactable by arbitrary AI buyers."**

We build the **merchant-side trust infrastructure** — not a shopping bot. The merchant controls the trust boundary around money. The buyer agent is a test harness (~20% effort) that demonstrates, tests, and attacks the merchant platform (~80% effort).

### 0.5 Core Architectural Invariant

```
LLM → PROPOSAL → DETERMINISTIC VALIDATION → POLICY → AUTHORIZATION → TRANSACTION FSM → PAYMENT
```

The LLM is UNTRUSTED. It may propose. It may NOT execute, authorize, bypass, or decide financial outcomes. This invariant must NEVER be violated for convenience.

### 0.6 Hard Constraints (NEVER Violate)

1. **LLM cannot authorize payment, bypass policy, or call Razorpay directly**
2. **Never hold a PostgreSQL transaction open while waiting on Razorpay**
3. **Never assume timeout = failure for payment operations** (use reconciliation)
4. **Never retry financial operations blindly** (UNKNOWN ≠ FAILURE)
5. **Security fails closed** (unknown agent → DENY, expired auth → DENY, invalid hash → DENY)
6. **Frontend never implements business logic** (backend is authoritative)
7. **MCP is a protocol adapter only** (no business logic in MCP handlers)
8. **No direct DB access from MCP handlers, LLM code, or frontend**
9. **Never log API keys, bearer tokens, HMAC secrets, or sensitive payment info**
10. **Never fabricate benchmark values** (TARGET ≠ MEASURED RESULT)
11. **Every abstraction must earn its existence** (complexity is a resource)
12. **Never cache financial authorization state**

### 0.7 Directory Structure (APPROVED)

```
agentic-commerce/
├── cmd/
│   └── server/
│       └── main.go                    # Application entrypoint
├── internal/                          # Private application code
│   ├── domain/                        # Pure domain types and business rules
│   │   ├── merchant.go                # Merchant entity
│   │   ├── product.go                 # Product, ProductDetail entities
│   │   ├── agent.go                   # Agent, Session entities
│   │   ├── authorization.go           # Grant, Usage entities
│   │   ├── transaction.go             # Transaction entity, Status enum, FSM
│   │   ├── policy.go                  # PolicyDecision, PolicyEngine interface
│   │   ├── integrity.go               # IntegrityVerifier
│   │   └── errors.go                  # Domain error types
│   ├── application/                   # Use case orchestrators
│   │   ├── checkout.go                # CheckoutUseCase (Proposal + Payment saga)
│   │   ├── catalog.go                 # CatalogUseCase
│   │   ├── merchant.go                # MerchantUseCase
│   │   ├── session.go                 # AgentSessionUseCase
│   │   └── transaction.go             # TransactionUseCase
│   ├── infrastructure/                # External system adapters
│   │   ├── postgres/                  # PostgreSQL repository implementations
│   │   │   ├── catalog_repo.go
│   │   │   ├── auth_repo.go
│   │   │   ├── transaction_repo.go
│   │   │   ├── audit_repo.go
│   │   │   └── merchant_repo.go
│   │   ├── razorpay/                  # Razorpay payment gateway adapter
│   │   │   └── gateway.go
│   │   ├── redis/                     # Redis adapter (idempotency, rate limiting)
│   │   │   └── cache.go
│   │   └── gemini/                    # Gemini LLM adapter
│   │       └── provider.go
│   ├── mcp/                           # MCP protocol adapter
│   │   ├── server.go                  # MCP server setup
│   │   ├── tools.go                   # Tool definitions and handlers
│   │   ├── resources.go               # Resource definitions
│   │   └── middleware.go              # Auth, logging, rate limiting
│   ├── api/                           # REST API (for frontend + webhooks)
│   │   ├── router.go                  # HTTP router setup
│   │   ├── handlers.go                # REST handlers
│   │   ├── webhook.go                 # Razorpay webhook endpoint
│   │   └── middleware.go              # HTTP middleware
│   └── config/                        # Configuration loading
│       └── config.go
├── pkg/                               # Shared utilities (importable by any layer)
│   ├── database/                      # Transaction manager, DB interface
│   │   └── txmanager.go
│   ├── contextutil/                   # Typed context keys (AgentID, SessionID, etc.)
│   │   └── context.go
│   ├── logger/                        # Structured logging setup
│   │   └── logger.go
│   └── apperrors/                     # Application error types
│       └── errors.go
├── migrations/                        # SQL migration files
│   └── 000001_init_schema.up.sql
├── frontend/                          # React (Vite) dashboard
│   └── ...
├── docker-compose.yml                 # PostgreSQL + Redis
├── .env                               # Environment variables (not committed)
├── .env.example                       # Template for env vars
├── .gitignore
├── go.mod
├── go.sum
├── Makefile                           # Build, test, run commands
├── README.md
└── AGENTIC_COMMERCE_ARCHITECTURE_PLAN.md  # This file
```

**Dependency direction (STRICT):**
```
cmd/server → internal/config
cmd/server → internal/application
cmd/server → internal/infrastructure
cmd/server → internal/mcp
cmd/server → internal/api

internal/mcp        → internal/application (NEVER directly to infrastructure or domain)
internal/api         → internal/application (NEVER directly to infrastructure or domain)
internal/application → internal/domain
internal/application → Repository Interfaces (defined in domain)
internal/infrastructure/postgres → internal/domain (implements interfaces)
internal/infrastructure/razorpay → internal/domain (implements Gateway interface)

internal/domain → pkg/* (utilities only, NEVER to infrastructure)
```

### 0.8 Key Interfaces (Complete Reference)

```go
// --- Repository Interfaces (defined in internal/domain) ---

type CatalogRepository interface {
    GetProduct(ctx context.Context, productID uuid.UUID) (*ProductDetail, error)
    SearchProducts(ctx context.Context, filter SearchFilter) ([]ProductDetail, error)
    GetPolicies(ctx context.Context, merchantID uuid.UUID) ([]Policy, error)
}

type AuthorizationRepository interface {
    GetActiveGrant(ctx context.Context, agentID uuid.UUID) (*Grant, error)
    ReserveUsage(ctx context.Context, grantID uuid.UUID, amountPaise int64) error
    CommitUsage(ctx context.Context, grantID uuid.UUID, amountPaise int64) error
    ReleaseUsage(ctx context.Context, grantID uuid.UUID, amountPaise int64) error
}

type TransactionRepository interface {
    Create(ctx context.Context, tx *Transaction) error
    Get(ctx context.Context, id uuid.UUID) (*Transaction, error)
    UpdateStatus(ctx context.Context, id uuid.UUID, status TxStatus, reason string) error
    CheckIdempotency(ctx context.Context, key uuid.UUID, scope string) (*Transaction, error)
    RecordIdempotency(ctx context.Context, key uuid.UUID, scope string, txID uuid.UUID) error
}

type AuditRepository interface {
    RecordEvent(ctx context.Context, event AuditEvent) error
    RecordSecurityEvent(ctx context.Context, event SecurityEvent) error
    RecordPolicyDecision(ctx context.Context, decision PolicyDecisionRecord) error
}

type MerchantRepository interface {
    GetMerchant(ctx context.Context, id uuid.UUID) (*Merchant, error)
    GetCapabilities(ctx context.Context, merchantID uuid.UUID) ([]Capability, error)
}

// --- Domain Service Interfaces ---

type PolicyEngine interface {
    Evaluate(ctx context.Context, amountPaise int64, grant *Grant) (PolicyDecision, error)
}

type IntegrityVerifier interface {
    GenerateHash(productID uuid.UUID, pricePaise int64, currency string, versionID uuid.UUID) string
    Verify(productID uuid.UUID, actualPrice int64, currency string, currentVersionID uuid.UUID, agentHash string) bool
}

// --- Infrastructure Interfaces ---

type PaymentGateway interface {
    CreateOrder(ctx context.Context, amountPaise int64, currency string, receiptID string) (*GatewayOrder, error)
}

type LLMProvider interface {
    Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error)
    ChatWithTools(ctx context.Context, req ChatRequest, tools []ToolDef) (*ChatResponse, error)
}

// --- Application Use Case Interfaces ---

type CheckoutUseCase interface {
    CreateProposal(ctx context.Context, req ProposalRequest) (*ProposalResponse, error)
    ExecutePayment(ctx context.Context, req PaymentRequest) (*PaymentResponse, error)
}

type CatalogUseCase interface {
    SearchProducts(ctx context.Context, filter SearchFilter) ([]ProductDetail, error)
    GetProduct(ctx context.Context, productID uuid.UUID) (*ProductDetail, error)
}

type MerchantUseCase interface {
    GetCapabilities(ctx context.Context, merchantID uuid.UUID) (*MerchantInfo, error)
    GetPolicies(ctx context.Context, merchantID uuid.UUID) ([]Policy, error)
}

type TransactionUseCase interface {
    GetStatus(ctx context.Context, txID uuid.UUID) (*Transaction, error)
}
```

### 0.9 Transaction State Machine

```
CREATED ──────► AUTHORIZED ──────► PAYMENT_PENDING ──────► CAPTURED ──────► COMPLETED
  │                │                      │                    │
  ▼                ▼                      ▼                    ▼
EXPIRED          FAILED            PAYMENT_FAILED           FAILED
                   │               PAYMENT_STATUS_UNKNOWN
                   ▼                      │
                (terminal)                ▼
                                   (reconciliation)
```

**Valid transitions (enforced in Go + DB trigger):**
```go
var validTransitions = map[TxStatus][]TxStatus{
    StatusCreated:        {StatusAuthorized, StatusFailed, StatusExpired},
    StatusAuthorized:     {StatusPaymentPending, StatusFailed, StatusExpired},
    StatusPaymentPending: {StatusCaptured, StatusPaymentFailed, StatusPaymentUnknown},
    StatusCaptured:       {StatusCompleted, StatusFailed},
    StatusPaymentFailed:  {StatusPaymentPending, StatusFailed},  // retry
    StatusPaymentUnknown: {StatusPaymentPending, StatusFailed, StatusCaptured},  // after reconciliation
}
```

### 0.10 MCP Tools Reference

| Tool | Risk Level | Maps To | Input | Output |
|------|-----------|---------|-------|--------|
| `search_products` | READ | `catalog.UseCase.SearchProducts()` | `{query?, category?, max_price?, limit?}` | `[{id, name, price, currency, inventory, product_hash}]` |
| `get_product` | READ | `catalog.UseCase.GetProduct()` | `{product_id}` | `{id, name, price, currency, inventory, catalog_version_id, product_hash}` |
| `discover_merchant` | READ | `merchant.UseCase.GetCapabilities()` | `{merchant_id}` | `{id, name, capabilities, status}` |
| `get_policies` | READ | `merchant.UseCase.GetPolicies()` | `{merchant_id}` | `[{type, title, content}]` |
| `create_purchase_proposal` | FINANCIAL | `checkout.UseCase.CreateProposal()` | `{product_id, quantity, expected_price, catalog_version_id, product_hash, proposal_idempotency_key}` | `{proposal_id, status, policy_decision}` |
| `execute_payment` | FINANCIAL | `checkout.UseCase.ExecutePayment()` | `{proposal_id, payment_idempotency_key}` | `{transaction_id, status, gateway_order_id}` |
| `get_transaction_status` | READ | `transaction.UseCase.GetStatus()` | `{transaction_id}` | `{id, status, amount, currency, created_at}` |

### 0.11 Purchase Flow (Reservation Saga)

```
PHASE 1 — Reservation (DB Transaction 1):
  1. Check idempotency
  2. Load product + verify integrity (hash comparison)
  3. Load active grant + evaluate policy
  4. Reserve usage (atomic SQL: consumed + reserved + amount <= limit)
  5. Create transaction (status: CREATED)
  6. Record idempotency key
  7. COMMIT DB Transaction 1

PHASE 2 — External Call (NO DB locks held):
  8. Call Razorpay CreateOrder API

PHASE 3 — Commit/Release (DB Transaction 2):
  IF Razorpay succeeded:
    9a. Commit usage (reserved → consumed)
    9b. Update transaction status → PAYMENT_PENDING
    9c. Store Razorpay order mapping
  IF Razorpay failed:
    9d. Release usage (reserved → available)
    9e. Update transaction status → FAILED
  IF Razorpay timed out:
    9f. Update transaction status → PAYMENT_STATUS_UNKNOWN
    9g. Leave reservation in place
    9h. Background reconciliation job will resolve
  10. COMMIT DB Transaction 2
```

### 0.12 Environment Setup

```yaml
# docker-compose.yml services:
PostgreSQL 16 Alpine — port 5455:5432
Redis 7 Alpine      — port 6379:6379
```

```env
# Required environment variables:
PORT=8080
DATABASE_URL=postgres://commerce_user:commerce_password@127.0.0.1:5455/agentic_commerce?sslmode=disable
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
GEMINI_API_KEY=...
```

### 0.13 Approved Decisions Summary

| # | Decision | Status |
|---|----------|--------|
| 001 | Go as primary backend language | ✅ APPROVED |
| 002 | Modular monolith architecture | ✅ APPROVED |
| 003 | PostgreSQL as primary database | ✅ APPROVED |
| 004 | Redis for cache/idempotency/rate limiting | ✅ APPROVED |
| 005 | LLM is architecturally untrusted | ✅ APPROVED |
| 006 | React (Vite) dashboard, display layer only | ✅ APPROVED |
| 007 | MCP as primary agent interface (scoped subset) | ✅ APPROVED |
| 008 | Gemini 2.5 Flash with provider-agnostic abstraction | ✅ APPROVED |

### 0.14 Pending Decisions (Require Approval Before Implementation)

| # | Decision Needed | Context |
|---|----------------|---------|
| D-009 | HTTP Router: `net/http` (Go 1.22+ routing) vs `chi` | Phase A foundation |
| D-010 | MCP Go library: `github.com/mark3labs/mcp-go` vs hand-roll | Phase F |
| D-011 | Gemini Go SDK: `google/generative-ai-go` vs raw HTTP | Phase G |
| D-012 | Razorpay: `razorpay/razorpay-go` SDK vs raw HTTP | Phase E |
| D-013 | Testing: stdlib `testing` + `testify` vs other | Phase I |
| D-014 | Single vs multi-merchant MVP | Phase C schema design |
| D-015 | Webhook tunnel for local dev (ngrok/cloudflared) | Phase E |
| D-016 | Schema corrections (see Section 10.18) | Phase C |

---

## 1. Project Context


**What:** AI Commerce Trust & Readiness Layer for Merchants, built on Razorpay test-mode APIs.

**Why:** AI agents are increasingly initiating commerce. No infrastructure exists for merchants to verify, constrain, and audit AI-initiated transactions — or for agents to verify merchant catalog integrity.

**For whom:** Razorpay AI Buildathon 2026, Track 01 — AI Growth & Agentic Commerce.

**Hackathon Details (VERIFIED):**
- **Deadline:** September 5, 2026 (application deadline)
- **Track:** "Grow the merchant's revenue, and make them sellable to AI buyers"
- **Format:** Student-only, build-first selection, no resume screening
- **Submission:** Public repo + 5-min pitch video + architecture docs
- **Judging:** Functionality, Explainability & Safety, Failure Handling, Technical Depth
- **Outcome:** Direct technical panel interview for AI Builder Intern (6/12-month, Bangalore)

**Key Judging Criteria (VERIFIED from official source):**
1. Working, real-world prototype
2. Every "money action" must be explainable, bounded, and gated
3. Must demonstrate audit trail + at least one failure handled gracefully
4. Must justify architecture choices (models, frameworks, stores)

**Repository:** Greenfield — empty directory, no existing code or debt.

**Primary Language:** Go (confirmed by user)

**LLM Strategy:** Provider-agnostic architecture, single provider for MVP

**Razorpay:** Test-mode credentials via env vars (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)

---

## 2. Product Thesis

> **"Make merchants trustworthy and transactable by arbitrary AI buyers."**

We are NOT building a buyer-side shopping agent. We are building the **merchant-side trust infrastructure** that enables any AI buyer agent to:

1. **Discover** — find the merchant and understand its capabilities
2. **Verify** — confirm catalog integrity, pricing authenticity, policy accuracy
3. **Transact** — execute a purchase through deterministic authorization
4. **Audit** — trace every step from intent to payment to fulfillment

The buyer agent is a controlled test harness (~20% of effort) that demonstrates, tests, and attacks the merchant platform (~80% of effort).

---

## 3. Problem Statement

Current AI commerce has a fundamental trust gap:

```
LLM reasons about products → LLM calls payment API → Money moves
```

**Problems with this:**
- LLM can hallucinate purchase decisions
- LLM can be prompt-injected via malicious catalog content
- No deterministic authorization layer
- No verification of merchant data integrity
- No audit trail explaining WHY a transaction happened
- No protection against replay, duplication, or race conditions
- No standard for merchant AI-readiness

**Our solution interposes a trust layer:**

```
LLM proposes action
    → Deterministic policy evaluation
    → Authorization check
    → Risk assessment
    → Payment execution (Razorpay)
    → Webhook verification
    → Audit trail
```

---

## 4. Target Users

### Primary: Merchant (Seller)
- Wants to sell to AI agents without building custom integrations per agent
- Needs machine-readable catalog, policies, capabilities
- Needs protection from malicious buyer agents
- Needs auditability for AI-initiated transactions

### Secondary: Buyer Agent (Test Harness)
- Controlled AI agent that discovers merchants, evaluates products, proposes purchases
- Used to demonstrate and attack the merchant platform
- Validates that trust boundaries work correctly

### Tertiary: Human User (Principal)
- Sets authorization policies (spending limits, merchant restrictions, product categories)
- Reviews audit trail
- Grants/revokes agent permissions

---

## 5. Hackathon Requirements Mapping

| Judging Criterion | How We Address It |
|---|---|
| Working prototype | End-to-end: agent discovers merchant → proposes purchase → policy evaluation → Razorpay order/payment → webhook → audit |
| Explainable money actions | Structured audit trail with policy decision reasoning (NOT LLM prose) |
| Bounded & gated actions | Deterministic policy engine with spending limits, merchant restrictions, time bounds |
| Failure handling demo | Demonstrate: duplicate payment prevention, webhook replay handling, unauthorized agent rejection, stale authorization detection |
| Architecture justification | This document + decision log with alternatives analysis |

---

## 6. Competitive Landscape

### What Razorpay Already Does
| Product | What It Does | Why We Don't Rebuild It |
|---|---|---|
| Agent Studio | Pre-built agents for disputes, abandoned carts, subscriptions | Focuses on merchant ops automation, not trust infrastructure |
| Agentic Payments (ChatGPT/NPCI) | In-chat checkout via UPI | Buyer-side UX, not merchant-side verification |
| "Sell on ChatGPT" | Merchant catalog upload for ChatGPT discovery | Catalog upload only, no trust/verification layer |

### Protocol Landscape (as of Aug 2026)
| Protocol | Purpose | Our Relationship |
|---|---|---|
| MCP | Agent-to-tool integration | We expose merchant capabilities as MCP tools |
| ACP (OpenAI/Stripe) | Agent-to-merchant commerce sessions | We are ACP-aware but not ACP-dependent |
| UCP (Google/Shopify) | Universal commerce discovery | We align with UCP's machine-readable catalog concept |
| AP2 (Google) | Authorization mandates (W3C VCs) | We borrow the mandate model for our policy engine |
| x402 | HTTP-native machine payments | Not relevant — we use Razorpay, not crypto settlement |
| UAP (NPCI) | UPI agent authorization | Not yet live — we design for compatibility, label as simulation |

### Industry Players
| Player | What They Do | Our Differentiation |
|---|---|---|
| Mastercard Agent Pay | Token-based agent payment auth | Card network level — we operate at merchant platform level |
| Visa TAP | Agent cryptographic signatures | Network auth — we provide merchant-side verification |
| Generic MCP catalog servers | Expose products as MCP tools | We add integrity verification, policy enforcement, audit |
| Agent wallets (various) | Spending caps for agents | We provide the merchant-side counterpart |

---

## 7. What We Explicitly Will NOT Build

| DO NOT BUILD | Reason |
|---|---|
| Another AI shopping chatbot | Crowded, not our thesis |
| Abandoned cart recovery agent | Razorpay Agent Studio already does this |
| Dispute management agent | Razorpay Agent Studio already does this |
| Generic agent wallet | Already exists in multiple forms |
| Full ACP/UCP/AP2 implementation | Protocol worship — we take inspiration, not dependency |
| x402 payment integration | No genuine architectural reason (we use Razorpay, not crypto) |
| Live UAP integration | UAP not yet finalized by NPCI |
| Multi-LLM orchestration framework | Not our problem space |
| Frontend shopping UI | Buyer agent is API-only test harness |
| Kubernetes deployment | Unnecessary complexity for MVP |

---

## 8. Product Differentiation

### Our Unique Wedge
Nobody is building the **merchant-side trust infrastructure** for agentic commerce on Indian payment rails (Razorpay/UPI).

Existing solutions focus on:
- Buyer-side: agent wallets, spending caps, in-chat checkout
- Protocol-side: ACP sessions, UCP discovery, AP2 mandates
- Network-side: Mastercard/Visa tokenization

**Gap we fill:** The merchant needs infrastructure to:
1. Expose verified, tamper-evident catalog data to AI agents
2. Verify that a buyer agent is legitimate and authorized
3. Enforce deterministic spending/category/merchant policies
4. Execute payments safely through Razorpay with full idempotency
5. Produce a structured audit trail for every transaction
6. Handle failures gracefully (duplicates, replays, race conditions, timeouts)

### Demo Story
> "Watch an AI buyer agent discover our merchant, browse products, propose a ₹4,500 purchase. The policy engine checks: Is this agent authorized? Is the spending limit sufficient? Is this product category allowed? Is the authorization still valid? ALLOW. Razorpay order created, payment captured, webhook verified, audit trail complete. Now watch what happens when we inject a malicious catalog, replay a webhook, send a duplicate payment request, or use an expired authorization. Every attack is detected, logged, and handled gracefully."

---

## 9. First-Pass Architecture Hypothesis

### Architecture Style: Modular Monolith (Go)

Single Go binary with clean internal module boundaries:

```
┌─────────────────────────────────────────────────┐
│                   API Gateway                    │
│            (HTTP Router + Middleware)             │
├─────────┬──────────┬───────────┬────────────────┤
│Merchant │  Agent   │  Policy   │   Transaction  │
│ Service │ Service  │  Engine   │    Service     │
├─────────┴──────────┴───────────┴────────────────┤
│              Payment Service                     │
│          (Razorpay Integration)                  │
├─────────────────────────────────────────────────┤
│          Webhook Handler + Deduplication          │
├─────────────────────────────────────────────────┤
│              Audit Service                       │
├──────────────────┬──────────────────────────────┤
│   PostgreSQL     │         Redis                 │
│ (primary store)  │   (cache + idempotency)       │
└──────────────────┴──────────────────────────────┘

Buyer Agent (separate Go service or CLI) ──→ API Gateway
```

**Why modular monolith:**
- Single deployment unit — simpler ops for hackathon
- Clean module boundaries allow future extraction to services
- Go compilation speed + single binary deployment
- No inter-service network latency
- No distributed transaction complexity
- Sufficient for 10K+ concurrent connections (Go goroutine model)

---

## 10. First-Pass Threat Model (Top 8)

| # | Threat | Attack Vector | Impact | Mitigation |
|---|--------|--------------|--------|------------|
| T1 | Prompt injection via catalog | Malicious product descriptions | Agent buys wrong product/quantity | Sanitize catalog before LLM exposure; structured data only to policy engine |
| T2 | Unauthorized agent | Forged or missing agent identity | Unauthorized purchases | HMAC-signed agent tokens, server-side verification |
| T3 | Replay attack | Re-send captured valid request | Duplicate purchase/charge | Idempotency keys + nonce tracking in Redis |
| T4 | Stale authorization | Use expired spending limit | Exceed intended limits | Time-bounded tokens, check expiry at policy evaluation |
| T5 | Webhook spoofing | Fake Razorpay webhook | False payment confirmation | HMAC-SHA256 signature verification using webhook secret |
| T6 | Webhook replay | Re-send legitimate webhook | Duplicate fulfillment | Event ID deduplication in database |
| T7 | Race condition | Concurrent purchase requests | Exceed spending limit | PostgreSQL advisory locks or SELECT FOR UPDATE |
| T8 | LLM bypass | Direct API call skipping policy | Unauthorized payment | Architectural separation — payment service only accepts policy-engine-signed tokens |

---

## 11. First-Pass Technology Hypothesis

| Component | Choice | Why | Alternatives Considered |
|---|---|---|---|
| Backend | Go 1.22+ | Performance, concurrency, type safety, user expertise | Node.js, Python, Rust |
| HTTP Router | chi or net/http | Lightweight, idiomatic | Gin, Echo, Fiber |
| Database | PostgreSQL | ACID, JSON support, advisory locks | MySQL, SQLite, MongoDB |
| Cache | Redis | Idempotency keys, rate limiting | Memcached, in-memory |
| Razorpay SDK | razorpay-go | Official Go SDK | Raw HTTP |
| LLM (MVP) | Gemini 2.5 Flash (provider-agnostic abstraction) | Tool calling, structured output, low latency, free tier | Claude, GPT-4o |
| Deployment | Docker Compose → cloud VM | Simplest path | K8s, serverless |
| Observability | slog + OpenTelemetry | Trace full request chain | ELK, Datadog |

---

## 12. MVP Scope (APPROVED)

### IN SCOPE — HACKATHON MVP

1. **Merchant registration** — identity, catalog, policies, capabilities
2. **Multi-tenant-ready data model** — merchant_id boundaries, tenant-safe queries, tenant-aware authorization (advanced tenant management NOT required)
3. **Machine-readable merchant catalog** — structured products, pricing, inventory, policies, capability metadata
4. **Catalog integrity** — content hashing, integrity verification, detection of unexpected modification
5. **Agent authentication** — HMAC-based auth with abstraction for future stronger mechanisms
6. **Agent authorization** — spending limits, category restrictions, merchant restrictions, time bounds, expiry, revocation
7. **Buyer-agent purchase flow** — discover → request → intent validation → policy evaluation → authorization → Razorpay order → payment → webhook → final state
8. **Deterministic policy engine** — ALLOW / DENY / REQUIRE_ADDITIONAL_AUTHORIZATION with structured reasoning
9. **Razorpay integration** — Orders API, Payments API, webhook handling, signature verification, test-mode
10. **Payment safety** — idempotency, duplicate prevention, replay protection, race-safe state transitions, webhook deduplication, out-of-order event handling
11. **Transaction state machine** — CREATED → AUTHORIZED → PAYMENT_PENDING → CAPTURED → COMPLETED with explicit failure states
12. **Structured audit trail** — user intent, authorization, agent identity, agent proposal, policy decision, authorization decision, transaction, Razorpay IDs, webhook events, final state, security/failure events
13. **Security demonstrations** — unauthorized agent, expired/stale auth, replay attack, duplicate payment, duplicate webhook, malicious catalog/tool-poisoning, policy violation
14. **Graceful failure** — no duplicate charges, no inconsistent state, no lost audit information
15. **Performance foundation** — stateless where appropriate, connection-pooled, indexed, concurrency-safe, cache-ready, async-extensible, horizontally scalable architecture (large-scale deployment NOT required)
16. **Observability foundation** — structured logs, request/transaction/agent IDs, basic metrics, audit events
17. **Load testing** — actual benchmarks on critical path: throughput, p50, p95, p99, error rate, DB latency, concurrent requests
18. **React (Vite) demo dashboard** — merchant dashboard, live transaction flow visualization, policy decision view, audit trail, attack demo panel, agent authorization view (display layer only, zero business logic)

### OUT OF SCOPE — POST-MVP

1. Advanced multi-tenancy (teams, org management, billing, complex RBAC)
2. Full MCP server implementation
3. Full ACP/UCP/AP2 compliance
4. Live NPCI UAP integration
5. Production-scale cloud infrastructure
6. Kubernetes / complex orchestration
7. Large-scale horizontal deployment
8. ML-based risk scoring
9. Multi-currency support
10. Refund workflows
11. Dispute / chargeback workflows
12. Subscription management
13. Advanced merchant analytics
14. Merchant marketplace / platform ecosystem
15. Advanced agent reputation system
16. Cross-protocol interoperability
17. Full cryptographic agent identity infrastructure
18. Advanced fraud detection

---

## 13. Razorpay Integration Strategy

### APIs Required (VERIFIED)

| API | Purpose | Required? | Test Mode? |
|-----|---------|-----------|------------|
| Orders API (POST /v1/orders) | Create order before payment | YES | ✅ |
| Payments API (GET /v1/payments/:id) | Verify payment status | YES | ✅ |
| Webhooks (order.paid, payment.captured) | Async payment confirmation | YES | ✅ |
| Signature Verification | Verify webhook authenticity | YES | ✅ |
| Customers API | Link payments to customers | OPTIONAL | ✅ |

### Payment Flow
```
1. Create Order via API (amount, currency, receipt)
2. Order ID returned → stored in DB
3. Payment executed (simulated in test mode)
4. Razorpay sends webhook (order.paid / payment.captured)
5. Verify signature (HMAC-SHA256 of raw body)
6. Update transaction state machine
7. Deduplicate using x-razorpay-event-id
```

### Critical Constraints
- Webhook must respond 2xx within 5 seconds
- At-least-once delivery → must handle duplicates
- Use x-razorpay-event-id for deduplication
- Cannot use localhost for webhooks → need tunnel for dev
- Go SDK: github.com/razorpay/razorpay-go (requires Go 1.22+)

---

## 14. Performance Targets (NOT MEASURED)

| Operation | Target p95 |
|-----------|-----------|
| Catalog discovery | < 50ms |
| Policy evaluation | < 10ms |
| Order creation (incl. Razorpay) | < 500ms |
| Webhook processing | < 100ms |
| Full purchase flow E2E | < 1s |

---

## 15. Protocol Strategy Summary

| Protocol | Relationship | MVP Implementation |
|----------|-------------|-------------------|
| **MCP** | **PRIMARY agent interface** | Production-quality MCP server (scoped subset — see DECISION-007) |
| ACP | AWARE, not dependent | Mirror session model conceptually |
| AP2 | INSPIRED BY mandates | Authorization grants = simplified mandates |
| UCP | ALIGNED with catalog concept | Structured JSON catalog |
| UAP | SIMULATION ONLY | Mirror scope/ceiling/duration, label clearly |
| x402 | NOT USED | No architectural reason |

### MCP MVP Scope (IN SCOPE)

**Tools (agent-callable functions):**
- `discover_merchant` — merchant identity and capabilities
- `search_products` — catalog search with filters
- `get_product` — detailed product info with integrity hash
- `get_inventory` — real-time stock status
- `get_merchant_policies` — return/shipping/payment policies
- `create_purchase_proposal` — propose a purchase (goes to policy engine)
- `get_transaction_status` — check transaction state

**Resources (agent-readable data):**
- Merchant profile
- Product catalog
- Policy documents
- Capability descriptors

**Security enforced at MCP layer:**
- Agent authentication (HMAC)
- Input validation and sanitization
- Catalog content sanitization before LLM exposure
- Request correlation IDs
- Audit logging of all tool calls
- Rate limiting

**MCP features EXCLUDED from MVP:**

| Feature | Why Excluded | Interop Impact | How to Add Later |
|---------|-------------|----------------|------------------|
| Prompts (templates) | Not needed — buyer agent has own prompts | Low | Add prompt handlers to MCP server |
| Sampling | Server-initiated LLM calls not needed | Low | Add sampling handler |
| Multi-transport (SSE) | stdio sufficient for MVP | Medium | Add SSE transport adapter |
| Dynamic tool registration | Static tool set sufficient | Low | Add tool registry |
| Resource subscriptions | Real-time catalog updates not needed for MVP | Low | Add pub/sub on resource changes |

---

## 16. Open Questions

| # | Question | Blocking? |
|---|----------|-----------|
| Q1 | ~~Which LLM provider for MVP?~~ | ✅ RESOLVED — Gemini 2.5 Flash (DECISION-008) |
| Q2 | Webhook tunnel for local dev? | Yes |
| Q3 | How to demo failures in 5-min video? | No |
| Q4 | Single vs multi-merchant MVP? | No |
| Q5 | MCP server or simplified tool API? | No |

---

## 17. Assumptions

| # | Assumption | Risk if Wrong |
|---|-----------|--------------|
| A1 | Razorpay test mode supports needed webhook events | Must verify with actual tests |
| A2 | razorpay-go SDK is stable | Fallback: raw HTTP |
| A3 | Single PostgreSQL sufficient for MVP | Very low risk |
| A4 | Judges value engineering depth over feature count | May need more features |
| A5 | Sept 5 is application deadline | Need to verify submission process |

---

## DECISION LOG

### DECISION-001 — Primary Backend Language

**STATUS:** ✅ APPROVED
**DATE:** 2026-08-22

**DECISION:** Go as primary backend language.

**WHY:** User expertise + performance + concurrency + single-binary deployment + type safety.

**ALTERNATIVES:** Node.js (single-threaded), Python (GIL), Rust (slower dev velocity).

**APPROVED BY:** User (2026-08-22)

---

### DECISION-002 — Architecture Style

**STATUS:** ✅ APPROVED
**DATE:** 2026-08-22

**DECISION:** Modular monolith with clean internal module boundaries.

**WHY:** Single deployment unit, no inter-service latency, no distributed transactions. Internal Go packages enforce separation. Can extract to services later.

**ALTERNATIVES:** Microservices (too complex), flat monolith (unmaintainable), 2-3 services (unnecessary overhead).

**APPROVED BY:** User (2026-08-22)

---

### DECISION-003 — Database

**STATUS:** ✅ APPROVED
**DATE:** 2026-08-22

**DECISION:** PostgreSQL as primary database.

**WHY:** ACID is non-negotiable for payments. Advisory locks for race prevention. JSON support for audit events. User has prior experience.

**ALTERNATIVES:** MySQL (weaker JSON), SQLite (not concurrent), MongoDB (no ACID).

**APPROVED BY:** User (2026-08-22)

---

### DECISION-004 — Cache Layer

**STATUS:** ✅ APPROVED
**DATE:** 2026-08-22

**DECISION:** Redis for caching, idempotency, and rate limiting.

**WHY:** Atomic SET NX with TTL for idempotency keys. Sub-millisecond reads. Purpose-built for this workload.

**ALTERNATIVES:** In-memory (not shared), Memcached (less features), no cache (slower).

**APPROVED BY:** User (2026-08-22)

---

### DECISION-005 — LLM Trust Boundary

**STATUS:** ✅ APPROVED
**DATE:** 2026-08-22

**DECISION:** LLM is architecturally untrusted. Can PROPOSE, cannot EXECUTE. Policy engine is separate deterministic module.

**WHY:** Core thesis. If LLM can bypass policy engine, entire trust layer is meaningless. Architectural enforcement, not prompt-based restrictions.

**ALTERNATIVES:** Prompt-based guardrails (bypassable), function-calling constraints (still LLM-dependent), no LLM (too restrictive).

**APPROVED BY:** User (2026-08-22)

---

### DECISION-006 — Frontend Dashboard

**STATUS:** ✅ APPROVED
**DATE:** 2026-08-22

**DECISION:** React (Vite) demo/operations dashboard. Display layer only — zero business logic.

**WHY:** 5-minute pitch video requires visual demonstration. Dashboard shows policy decisions, transaction flows, audit trails, and attack detection visually.

**VIEWS:** Merchant dashboard, live transaction flow, policy decision view, audit trail, attack demo panel, agent authorization view.

**CONSTRAINT:** Frontend is untrusted client. All policy, authorization, and payment logic stays in Go backend. Frontend communicates via REST API + WebSocket.

**ALTERNATIVES:** Go templates (hard to make beautiful), Next.js (overkill), plain HTML/JS (too slow to build).

**APPROVED BY:** User (2026-08-22)

---

### DECISION-007 — MCP as Primary Agent Interface

**STATUS:** ✅ APPROVED
**DATE:** 2026-08-22

**DECISION:** Implement a production-quality MCP server as the primary AI-agent interaction interface. Scoped to a focused subset: merchant discovery, catalog/product tools, inventory, policies, purchase proposals, transaction status. Full auth, validation, audit at MCP layer.

**WHY:** MCP is the de-facto standard for agent-to-tool interaction. Exposing our merchant platform as an MCP server means ANY MCP-compatible AI agent can interact with our merchant — not just our buyer agent. This is the literal meaning of "make merchants AI-ready."

**SCOPE:** Production-quality subset (7 tools, 4 resource types, full security). NOT the entire MCP spec. Excluded features documented with rationale.

**CONSTRAINT:** MCP layer CANNOT bypass policy engine or authorization. Tool calls that involve money (create_purchase_proposal) must go through the deterministic policy evaluation pipeline.

**ALTERNATIVES:** Custom REST API only (not interoperable with arbitrary agents), full MCP spec (too large for MVP), ACP-only (OpenAI/Stripe-specific).

**APPROVED BY:** User (2026-08-22)

---

### DECISION-008 — LLM Provider & Abstraction

**STATUS:** ✅ APPROVED
**DATE:** 2026-08-22

**DECISION:** Gemini 2.5 Flash as MVP LLM provider, behind a provider-agnostic abstraction layer (LLMProvider interface with GeminiProvider, future OpenAIProvider, AnthropicProvider).

**WHY:**
1. Strong function/tool calling support (JSON Schema definitions)
2. Structured output (response_schema + application/json)
3. Low latency (Flash family optimized for throughput)
4. Free tier available for development (~10 RPM, ~250K TPM, ~250 RPD — VERIFY in AI Studio dashboard)
5. Sufficient quality for hackathon demo
6. Easy replacement via abstraction layer

**VERIFIED (Aug 2026):**
- Gemini 2.5 Flash is GA and supported across Google AI Studio and Vertex AI
- Free tier: no credit card required, rate-limited (~10 RPM, limits per project not per key)
- Free tier data caveat: inputs/outputs may be used by Google to improve products
- ⚠️ NOTE: Gemini 2.5 is now "older generation" — Gemini 3.x is the current frontier. 2.5 Flash is still supported but monitor deprecation timelines.

**FALLBACK:** Gemini 2.5 Flash-Lite for lower-cost operations. If Gemini becomes unavailable, swap provider via abstraction layer.

**ARCHITECTURAL CONSTRAINT:** LLM abstraction interface. Core commerce/auth/policy/payment/audit layers have ZERO dependency on Gemini or any specific provider. LLM is untrusted — can understand, search, propose, but CANNOT execute payments, bypass auth, modify policies, or self-authorize.

**ALTERNATIVES:** GPT-4o (better reasoning, higher cost, no free tier), Claude 3.5 (strong tool use, higher cost), local models (insufficient quality).

**APPROVED BY:** User (2026-08-22)

---

## PHASE 7 — DATA MODEL ANALYSIS (PROPOSED)

### 7.1 Complete Entity List (20 tables)

**Core Commerce (5):**
- `merchants` — merchant identity, configuration, API credentials
- `products` — catalog items with integrity hashes
- `product_inventory` — mutable stock quantities (separate from products)
- `merchant_policies` — return/shipping/payment policies
- `merchant_capabilities` — supported payment methods, protocols, features

**Catalog Integrity (2):**
- `catalog_versions` — point-in-time snapshots of the full catalog (version number, aggregate hash)
- `catalog_integrity_records` — per-request verification events (hash at read vs hash at purchase)

**Agent & Authorization (5):**
- `agents` — registered buyer agent identities and HMAC credentials
- `agent_sessions` — bounded interaction periods (auth → expiry)
- `agent_requests` — individual MCP tool calls / API requests within a session
- `authorization_grants` — spending limits, restrictions, time bounds
- `authorization_usage` — tracks consumed amounts per grant

**Transaction (4):**
- `transactions` — core state machine
- `transaction_events` — append-only state transition log
- `razorpay_orders` — maps our transactions to Razorpay IDs
- `idempotency_keys` — deduplication records

**Events & Audit (4):**
- `webhook_events` — raw Razorpay webhook storage with dedup
- `audit_events` — high-level structured business event log
- `policy_decisions` — every policy evaluation with inputs, rules, result, reasoning
- `agent_security_events` — security-specific events (auth failures, replay attempts, integrity violations)

---

### 7.2 Analysis: product_inventory Separate from products

**DECISION: SEPARATE.**

**Why:** Products and inventory have fundamentally different access patterns:

- `products` is **read-heavy, rarely written.** Product name, description, price, category change infrequently. Many concurrent agents read products simultaneously.
- `product_inventory` is **write-heavy, contended.** Stock quantity changes on every purchase. Concurrent purchases compete for the same row.

If combined, a stock decrement would lock the entire product row, blocking concurrent reads of product details. Separation means:
- Product reads never block on inventory writes
- Inventory can use `SELECT FOR UPDATE` without affecting catalog browsing
- Future: inventory can move to a separate service/cache without touching catalog

**Interview point:** This is the **Command-Query Separation** principle applied at the data layer. Reads and writes have different performance characteristics, so they should not contend for the same lock.

---

### 7.3 Analysis: catalog_versions vs catalog_integrity_records

**catalog_versions** = WHAT the catalog looked like at a point in time.
- Created when a merchant updates any product
- Contains: version number, timestamp, aggregate hash of all products
- Purpose: "At version 7, the catalog contained these products at these prices"

**catalog_integrity_records** = DID the catalog change between when the agent read it and when the purchase was authorized?
- Created during the purchase flow
- Contains: product_id, hash_at_discovery, hash_at_purchase, matched (bool)
- Purpose: "The agent saw price ₹4,500 during browsing. At purchase time, the price was still ₹4,500. Integrity: VERIFIED."

**Relationship:** A transaction references BOTH:
- `transactions.catalog_version_id` → which catalog version was active
- `catalog_integrity_records` → per-product verification for that transaction

**Why both?** Version gives the big picture ("catalog v7"). Integrity records give per-product proof ("product X had hash Y at both discovery and purchase"). Together they answer: "Was the agent's decision based on accurate data?"

**Security demo:** For the catalog poisoning demo, we modify a product between discovery and purchase. The integrity record shows hash_at_discovery ≠ hash_at_purchase → INTEGRITY_VIOLATION → transaction DENIED.

---

### 7.4 Analysis: Agent Identity vs Session vs Request

**agents** = WHO (identity, long-lived)
- Registered once, has HMAC credentials
- Like a user account
- Question: "Is this agent known to us?"

**agent_sessions** = WHEN (bounded interaction, medium-lived)
- Created when agent authenticates, expires after timeout
- Tracks: session token, created_at, expires_at, status
- Question: "Is this agent currently authenticated?"
- Interview point: Sessions prevent stale credentials. Even if HMAC key is valid, an expired session forces re-authentication.

**agent_requests** = WHAT (individual action, ephemeral)
- Every MCP tool call or API request
- Tracks: session_id, tool_name, input_hash, response_status, latency, nonce
- Question: "What exactly did this agent do, in what order?"
- Critical for: replay detection (nonce), audit trail, rate limiting, debugging

**Hierarchy:** agent → has many sessions → each session has many requests

---

### 7.5 Analysis: Event Table Taxonomy

Five event tables, each serving a distinct purpose:

**transaction_events** — Payment lifecycle transitions
- "Transaction X moved from AUTHORIZED to PAYMENT_PENDING at timestamp T, triggered by action A"
- Used for: state machine history, debugging payment flow, reconciliation

**webhook_events** — External system events (Razorpay)
- Raw webhook payload storage, razorpay_event_id for deduplication
- Used for: dedup, reconciliation, debugging Razorpay integration

**policy_decisions** — Authorization reasoning
- "For transaction X, policy evaluated: spending_limit CHECK passed, category CHECK passed, time_validity CHECK passed → ALLOW"
- Used for: explainability (judging criterion!), compliance, debugging policy logic

**audit_events** — High-level business events
- "User granted agent A a ₹5,000 spending limit", "Agent A proposed purchase of product X"
- Used for: business audit trail, the 12-question auditability requirement

**agent_security_events** — Threat detection
- "Agent with invalid HMAC attempted access", "Replay detected: nonce X already used", "Catalog integrity violation on product Y"
- Used for: security demos, threat monitoring, incident investigation

**Why not one big events table?** Different retention policies, different query patterns, different indexes. Security events might need special access controls. Webhook events need raw payload storage. Policy decisions need structured rule evaluation fields. A single polymorphic table would require complex queries and prevent proper indexing.

---

### 7.6 Analysis: Concurrent Spending Limit Enforcement

**The race condition:**
```
Grant limit = ₹5,000
Request A = ₹4,000 (arrives at T=0ms)
Request B = ₹3,000 (arrives at T=1ms)
Total = ₹7,000 → MUST NOT exceed ₹5,000
```

**Approach 1: Row-Level Locking (SELECT FOR UPDATE)**
```sql
BEGIN;
SELECT used_amount FROM authorization_usage WHERE grant_id = $1 FOR UPDATE;
-- Application checks: used_amount + request_amount <= limit
UPDATE authorization_usage SET used_amount = used_amount + $2 WHERE grant_id = $1;
COMMIT;
```
- ✅ Correct — serializes access
- ❌ Requires explicit transaction management
- ❌ Holds lock for entire transaction duration (including policy evaluation)
- Latency: p95 ~2-5ms under low contention

**Approach 2: Atomic SQL UPDATE with Condition (RECOMMENDED)**
```sql
UPDATE authorization_usage
SET used_amount = used_amount + $1,
    updated_at = NOW()
WHERE grant_id = $2
  AND used_amount + $1 <= (
    SELECT max_amount FROM authorization_grants WHERE id = $2
  )
RETURNING used_amount;
```
- ✅ Correct — single atomic statement, implicit row lock only during UPDATE
- ✅ No explicit transaction needed for the check-and-update
- ✅ If 0 rows returned → insufficient limit → DENY
- ✅ Lock held for microseconds (just the UPDATE), not the entire policy evaluation
- Latency: p95 ~1-2ms

**Approach 3: Reservation Model**
- Phase 1: RESERVE (tentatively add amount, status=RESERVED)
- Phase 2: CONFIRM or RELEASE after payment
- ✅ Handles payment timeouts gracefully (release reservation)
- ❌ More complex, two SQL operations, reservation cleanup needed
- Best for: production evolution where payments take 30+ seconds

**Approach 4: Ledger Model**
- Append-only ledger entries (debits/credits)
- Current balance = SUM of all entries
- ✅ Most auditable, immutable history
- ❌ Requires aggregation query or materialized balance
- ❌ More complex for MVP
- Best for: financial compliance requirements

**Approach 5: Optimistic Concurrency**
- Read usage + version → attempt update with version check → retry on conflict
- ✅ No locks, high throughput
- ❌ Retries under contention, unbounded retry count possible
- ❌ For spending limits where correctness is critical, retries add risk

**RECOMMENDATION: Approach 2 (Atomic SQL UPDATE) for MVP.**

Simplest, correct, production-safe. Single statement. Lock held for microseconds. Clear DENY signal (0 rows returned). For production evolution, layer a reservation model on top for timeout handling.

---

### 7.7 Analysis: State Machine Enforcement

**PostgreSQL ENUM enforces valid VALUES** — you can't set status to 'BANANA'.
**PostgreSQL ENUM does NOT enforce valid TRANSITIONS** — nothing stops COMPLETED→CREATED.

**Two-layer enforcement:**

**Layer 1 — Application Code (Primary):**
```go
var allowedTransitions = map[TxState][]TxState{
    StateCreated:        {StateAuthorized, StateFailed, StateExpired},
    StateAuthorized:     {StatePaymentPending, StateFailed, StateExpired},
    StatePaymentPending: {StateCaptured, StatePaymentFailed},
    StateCaptured:       {StateCompleted, StateFailed},
    StatePaymentFailed:  {StatePaymentPending, StateFailed}, // retry
}
```
- Validates before UPDATE
- Returns clear error messages
- Logs invalid transition attempts

**Layer 2 — Database Trigger (Defense-in-Depth):**
```sql
CREATE FUNCTION enforce_transaction_transition() RETURNS TRIGGER AS $$
BEGIN
  IF NOT is_valid_transition(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'Invalid transition: % → %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```
- Catches bugs in application code
- Last line of defense
- Interview point: "Defense-in-depth — even if our Go code has a bug, the database rejects invalid transitions."

---

### 7.8 Critical Path vs Asynchronous

**CRITICAL PATH (synchronous, latency-sensitive):**
- `agents` — auth check on every request
- `authorization_grants` + `authorization_usage` — policy evaluation
- `products` + `product_inventory` — catalog lookup
- `transactions` — state machine read/write
- `razorpay_orders` — payment creation
- `idempotency_keys` — dedup check (Redis primary, DB fallback)

**ASYNC-SAFE (can be written after response):**
- `audit_events` — append after response
- `agent_security_events` — append after response
- `agent_requests` — log after response
- `catalog_integrity_records` — can verify async if not blocking purchase

**SYNC BUT FAST:**
- `policy_decisions` — must be sync for explainability (we return the reason in the response)
- `transaction_events` — must be sync (state transition proof)
- `webhook_events` — must be sync (dedup before processing)

---

### 7.9 Horizontal Scaling Support

- All tables have `merchant_id` → natural shard key if we ever need to partition
- Stateless app layer: multiple Go instances share same DB/Redis
- Read replicas: catalog queries (`products`, `merchant_policies`) can go to replicas
- Redis: idempotency checks stay in Redis (fastest), DB is fallback
- Audit/events: can move to separate write-optimized store (append-only workload)
- No cross-merchant joins required → clean partition boundary

### 7.10 MCP Interface Support

- `discover_merchant` → `merchants` + `merchant_capabilities`
- `search_products` → `products` (needs: INDEX on merchant_id, category, name)
- `get_product` → `products` + `product_inventory` + integrity hash computation
- `get_inventory` → `product_inventory`
- `get_merchant_policies` → `merchant_policies`
- `create_purchase_proposal` → creates `transactions` row, checks `authorization_grants`/`authorization_usage`, writes `policy_decisions`
- `get_transaction_status` → `transactions` + `transaction_events`

### 7.11 Security Demo Support

- **Unauthorized agent** → `agents` table lookup fails (invalid HMAC) → `agent_security_events` logged
- **Stale authorization** → `authorization_grants.expires_at < NOW()` → DENY → `policy_decisions` records reason
- **Replay attack** → `agent_requests.nonce` already exists OR `idempotency_keys` match → DENY → `agent_security_events` logged
- **Duplicate payment** → `transactions.idempotency_key` UNIQUE constraint → DB rejects → return existing transaction
- **Duplicate webhook** → `webhook_events.razorpay_event_id` UNIQUE → skip processing → log
- **Catalog poisoning** → `catalog_integrity_records` shows hash mismatch → DENY → `agent_security_events` logged

### 7.12 Entities Review — Should Any Be Removed?

**All 20 entities serve distinct, non-overlapping purposes.** No removal recommended.

Closest candidates for merging:
- `catalog_versions` + `catalog_integrity_records` → NO, different purposes (snapshot vs verification event)
- `audit_events` + `agent_security_events` → NO, different access patterns, retention, and sensitivity levels
- `transaction_events` + `audit_events` → NO, transaction_events is state-machine-specific, audit_events is business-level

---

### 7.13 Key UNIQUE Constraints and Indexes

**UNIQUE constraints (correctness):**
- `merchants(api_key_id)` — one key per merchant
- `products(merchant_id, sku)` — no duplicate SKUs per merchant
- `agents(hmac_key_id)` — one key per agent
- `transactions(idempotency_key)` — prevent duplicate transactions
- `webhook_events(razorpay_event_id)` — prevent duplicate webhook processing
- `agent_requests(session_id, nonce)` — prevent replay within session

**Indexes (performance):**
- `products(merchant_id, category)` — catalog search by category
- `products(merchant_id, is_active)` — active product listing
- `authorization_grants(agent_id, status, expires_at)` — find valid grants
- `transactions(merchant_id, status)` — merchant transaction dashboard
- `transactions(agent_id, created_at)` — agent transaction history
- `transaction_events(transaction_id, created_at)` — state history lookup
- `webhook_events(razorpay_order_id)` — correlate webhooks to orders
- `audit_events(merchant_id, created_at)` — audit trail queries

---

### 7.14 Detailed Schema Definitions (PROPOSED)

**Design conventions:**
- All primary keys: `id UUID DEFAULT gen_random_uuid()`
- All timestamps: `TIMESTAMPTZ` (UTC, timezone-aware)
- All money: `BIGINT` in paise (smallest currency unit) — never float
- Secrets: stored as hashes, never raw
- Soft deletes: `is_active BOOLEAN` or status ENUMs, no row deletion
- Every table: `created_at`, most have `updated_at`

#### 1. merchants

```sql
CREATE TABLE merchants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    api_key_id      TEXT NOT NULL UNIQUE,  -- public identifier for auth
    api_key_hash    TEXT NOT NULL,         -- bcrypt hash of secret
    webhook_secret  TEXT,                  -- for Razorpay webhook verification
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','suspended','inactive')),
    contact_email   TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Why api_key_id UNIQUE: fast auth lookup, prevents duplicate merchants
```

#### 2. products

```sql
CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     UUID NOT NULL REFERENCES merchants(id),
    sku             TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    category        TEXT NOT NULL,
    price_amount    BIGINT NOT NULL CHECK (price_amount > 0),  -- in paise
    price_currency  TEXT NOT NULL DEFAULT 'INR',
    image_url       TEXT,
    metadata        JSONB DEFAULT '{}',
    content_hash    TEXT NOT NULL,  -- SHA-256 of (name+description+price+category+sku)
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(merchant_id, sku)
);
CREATE INDEX idx_products_merchant_category ON products(merchant_id, category) WHERE is_active;
CREATE INDEX idx_products_merchant_active ON products(merchant_id, is_active);
-- Why content_hash: catalog integrity verification. Recomputed on any product update.
-- Why price in paise: ₹4,500.00 = 450000. No floating point errors in financial math.
```

#### 3. product_inventory

```sql
CREATE TABLE product_inventory (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id          UUID NOT NULL UNIQUE REFERENCES products(id),
    merchant_id         UUID NOT NULL REFERENCES merchants(id),
    quantity            INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity   INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Why product_id UNIQUE: one inventory record per product (1:1)
-- Why merchant_id redundant: enables merchant-scoped queries without JOIN to products
-- Why reserved_quantity: future reservation model support
```

#### 4. merchant_policies

```sql
CREATE TABLE merchant_policies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     UUID NOT NULL REFERENCES merchants(id),
    policy_type     TEXT NOT NULL CHECK (policy_type IN ('return','shipping','payment','privacy','terms')),
    title           TEXT NOT NULL,
    content         JSONB NOT NULL,  -- structured policy content
    version         INTEGER NOT NULL DEFAULT 1,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(merchant_id, policy_type, version)
);
-- Why JSONB content: policies have variable structure. Return policy differs from shipping policy.
-- Why version: policy changes are versioned, not overwritten. Transactions reference the policy version active at purchase time.
```

#### 5. merchant_capabilities

```sql
CREATE TABLE merchant_capabilities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     UUID NOT NULL REFERENCES merchants(id),
    capability_type TEXT NOT NULL,  -- 'payment_method', 'protocol', 'feature', 'delivery'
    capability_key  TEXT NOT NULL,
    capability_value JSONB DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(merchant_id, capability_type, capability_key)
);
-- Example: ('payment_method', 'upi', {"enabled": true})
-- Example: ('protocol', 'mcp', {"version": "1.0", "tools": ["search_products"]})
```

#### 6. catalog_versions

```sql
CREATE TABLE catalog_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     UUID NOT NULL REFERENCES merchants(id),
    version_number  INTEGER NOT NULL,
    aggregate_hash  TEXT NOT NULL,  -- SHA-256 of all product content_hashes combined
    product_count   INTEGER NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(merchant_id, version_number)
);
CREATE INDEX idx_catalog_versions_latest ON catalog_versions(merchant_id, version_number DESC);
-- Why aggregate_hash: single value to verify "has anything in the catalog changed?"
```

#### 7. catalog_integrity_records

```sql
CREATE TABLE catalog_integrity_records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id      UUID NOT NULL REFERENCES transactions(id),
    product_id          UUID NOT NULL REFERENCES products(id),
    catalog_version_id  UUID REFERENCES catalog_versions(id),
    hash_at_discovery   TEXT NOT NULL,
    hash_at_purchase    TEXT NOT NULL,
    integrity_verified  BOOLEAN NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_integrity_transaction ON catalog_integrity_records(transaction_id);
-- Why both hashes: proves what the agent saw vs what existed at purchase time
-- integrity_verified = (hash_at_discovery == hash_at_purchase)
```

#### 8. agents

```sql
CREATE TABLE agents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    hmac_key_id     TEXT NOT NULL UNIQUE,  -- public identifier
    hmac_key_hash   TEXT NOT NULL,         -- hash of secret key
    agent_type      TEXT NOT NULL DEFAULT 'buyer'
                    CHECK (agent_type IN ('buyer','auditor','test')),
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','suspended','revoked')),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Why agent_type: distinguishes buyer agents from test/auditor agents
-- Why status enum: suspended agent can be reactivated; revoked cannot
```

#### 9. agent_sessions

```sql
CREATE TABLE agent_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id            UUID NOT NULL REFERENCES agents(id),
    session_token_hash  TEXT NOT NULL,  -- hash of session token
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','expired','terminated')),
    ip_address          INET,
    user_agent          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL,
    ended_at            TIMESTAMPTZ
);
CREATE INDEX idx_sessions_agent_active ON agent_sessions(agent_id, status) WHERE status = 'active';
-- Why session_token_hash not raw: if DB is compromised, sessions can't be hijacked
-- Why expires_at: bounded sessions prevent indefinite access from stolen credentials
```

#### 10. agent_requests

```sql
CREATE TABLE agent_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES agent_sessions(id),
    agent_id        UUID NOT NULL REFERENCES agents(id),
    merchant_id     UUID REFERENCES merchants(id),
    request_type    TEXT NOT NULL,  -- 'mcp_tool_call', 'api_request'
    tool_name       TEXT,           -- MCP tool name if applicable
    input_hash      TEXT,           -- hash of request input for audit
    nonce           TEXT,           -- replay protection
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','completed','failed','rejected')),
    response_status INTEGER,       -- HTTP status or equivalent
    latency_ms      INTEGER,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, nonce)  -- prevents replay within session
);
CREATE INDEX idx_requests_session ON agent_requests(session_id, created_at);
CREATE INDEX idx_requests_agent ON agent_requests(agent_id, created_at);
-- Why UNIQUE(session_id, nonce): replay protection at DB level
```

#### 11. authorization_grants

```sql
CREATE TABLE authorization_grants (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id                UUID NOT NULL REFERENCES agents(id),
    granted_by              TEXT NOT NULL,  -- user/principal identifier
    merchant_id             UUID REFERENCES merchants(id),  -- NULL = any merchant
    max_amount              BIGINT NOT NULL CHECK (max_amount > 0),  -- paise
    currency                TEXT NOT NULL DEFAULT 'INR',
    allowed_categories      TEXT[],  -- NULL = all categories allowed
    denied_categories       TEXT[],  -- explicit denials override allows
    max_single_transaction  BIGINT,  -- max per-transaction limit (paise)
    status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','expired','revoked','exhausted')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at              TIMESTAMPTZ NOT NULL,
    revoked_at              TIMESTAMPTZ
);
CREATE INDEX idx_grants_agent_active ON authorization_grants(agent_id, status, expires_at)
    WHERE status = 'active';
-- Why merchant_id nullable: NULL means agent can transact with ANY merchant
-- Why both allowed/denied categories: deny takes priority (belt and suspenders)
-- Why max_single_transaction: prevents one huge purchase even within total limit
```

#### 12. authorization_usage

```sql
CREATE TABLE authorization_usage (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_id        UUID NOT NULL UNIQUE REFERENCES authorization_grants(id),
    used_amount     BIGINT NOT NULL DEFAULT 0 CHECK (used_amount >= 0),
    transaction_count INTEGER NOT NULL DEFAULT 0,
    last_used_at    TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Why UNIQUE(grant_id): exactly one usage tracker per grant (1:1)
-- Why separate table: this row is write-hot (updated every transaction)
--   while grants row is read-mostly. Separating prevents lock contention.
-- This is the table where the atomic UPDATE enforcement happens (see 7.6)
```

#### 13. transactions

```sql
CREATE TYPE tx_status AS ENUM (
    'created','authorized','payment_pending','captured',
    'completed','failed','expired','payment_failed'
);

CREATE TABLE transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id         UUID NOT NULL REFERENCES merchants(id),
    agent_id            UUID NOT NULL REFERENCES agents(id),
    grant_id            UUID NOT NULL REFERENCES authorization_grants(id),
    session_id          UUID REFERENCES agent_sessions(id),
    idempotency_key     TEXT NOT NULL UNIQUE,
    catalog_version_id  UUID REFERENCES catalog_versions(id),
    status              tx_status NOT NULL DEFAULT 'created',
    total_amount        BIGINT NOT NULL CHECK (total_amount > 0),
    currency            TEXT NOT NULL DEFAULT 'INR',
    product_id          UUID NOT NULL REFERENCES products(id),
    quantity            INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    failure_reason      TEXT,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tx_merchant_status ON transactions(merchant_id, status);
CREATE INDEX idx_tx_agent ON transactions(agent_id, created_at DESC);
CREATE INDEX idx_tx_grant ON transactions(grant_id);
-- Why idempotency_key UNIQUE: DB-level duplicate transaction prevention
-- Why tx_status ENUM: DB enforces valid values; Go code + trigger enforce valid transitions
```

#### 14. transaction_events

```sql
CREATE TABLE transaction_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID NOT NULL REFERENCES transactions(id),
    from_status     tx_status NOT NULL,
    to_status       tx_status NOT NULL,
    triggered_by    TEXT NOT NULL,  -- 'policy_engine', 'payment_service', 'webhook', 'timeout'
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tx_events_transaction ON transaction_events(transaction_id, created_at);
-- APPEND-ONLY: no UPDATE, no DELETE on this table
-- Every state change is permanently recorded
```

#### 15. razorpay_orders

```sql
CREATE TABLE razorpay_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id      UUID NOT NULL UNIQUE REFERENCES transactions(id),
    razorpay_order_id   TEXT NOT NULL UNIQUE,
    razorpay_payment_id TEXT,
    amount              BIGINT NOT NULL,
    currency            TEXT NOT NULL DEFAULT 'INR',
    status              TEXT NOT NULL DEFAULT 'created',
    razorpay_response   JSONB,  -- full API response for debugging
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Why transaction_id UNIQUE: one Razorpay order per transaction (1:1)
-- Why razorpay_order_id UNIQUE: prevents creating duplicate orders
-- Why razorpay_response JSONB: store full Razorpay response for reconciliation
```

#### 16. idempotency_keys

```sql
CREATE TABLE idempotency_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key             TEXT NOT NULL UNIQUE,
    resource_type   TEXT NOT NULL,   -- 'transaction', 'order'
    resource_id     UUID,
    status          TEXT NOT NULL DEFAULT 'processing'
                    CHECK (status IN ('processing','completed','failed')),
    response_code   INTEGER,
    response_body   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
-- Why response_body: on duplicate request, return the ORIGINAL response
-- Why expires_at: cleanup old keys. Redis handles hot-path; DB is fallback.
```

#### 17. webhook_events

```sql
CREATE TABLE webhook_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razorpay_event_id   TEXT NOT NULL UNIQUE,  -- x-razorpay-event-id header
    event_type          TEXT NOT NULL,          -- 'order.paid', 'payment.captured'
    razorpay_order_id   TEXT,
    razorpay_payment_id TEXT,
    payload             JSONB NOT NULL,         -- raw webhook body
    signature_verified  BOOLEAN NOT NULL DEFAULT false,
    processed           BOOLEAN NOT NULL DEFAULT false,
    processing_result   TEXT,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at        TIMESTAMPTZ
);
CREATE INDEX idx_webhook_order ON webhook_events(razorpay_order_id);
-- Why razorpay_event_id UNIQUE: deduplication — reject duplicate webhook delivery
-- Why store raw payload: reconciliation, debugging, audit
```

#### 18. audit_events

```sql
CREATE TABLE audit_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     UUID REFERENCES merchants(id),
    agent_id        UUID REFERENCES agents(id),
    transaction_id  UUID REFERENCES transactions(id),
    event_type      TEXT NOT NULL,     -- 'grant_created', 'purchase_proposed', 'payment_completed'
    event_category  TEXT NOT NULL,     -- 'authorization', 'transaction', 'security', 'system'
    description     TEXT NOT NULL,
    metadata        JSONB DEFAULT '{}',
    request_id      TEXT,              -- correlation ID across the system
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_merchant ON audit_events(merchant_id, created_at DESC);
CREATE INDEX idx_audit_transaction ON audit_events(transaction_id);
-- APPEND-ONLY: no UPDATE, no DELETE
-- This answers the 12 auditability questions from the requirements
```

#### 19. policy_decisions

```sql
CREATE TABLE policy_decisions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID NOT NULL REFERENCES transactions(id),
    agent_id        UUID NOT NULL REFERENCES agents(id),
    grant_id        UUID NOT NULL REFERENCES authorization_grants(id),
    decision        TEXT NOT NULL CHECK (decision IN ('allow','deny','require_approval')),
    amount          BIGINT NOT NULL,
    rules_evaluated JSONB NOT NULL,  -- list of all rules checked
    reasoning       JSONB NOT NULL,  -- structured explanation
    spending_check  JSONB,  -- {limit: 500000, used: 100000, requested: 450000, result: "pass"}
    category_check  JSONB,  -- {product_category: "electronics", allowed: true}
    time_check      JSONB,  -- {expires_at: "...", now: "...", result: "pass"}
    merchant_check  JSONB,  -- {required: null, actual: "merchant_123", result: "pass"}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_policy_transaction ON policy_decisions(transaction_id);
-- APPEND-ONLY: captures the EXACT reasoning at decision time
-- This is what makes money actions "explainable" (judging criterion)
-- Each check field is independently queryable for analytics
```

#### 20. agent_security_events

```sql
CREATE TABLE agent_security_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        UUID REFERENCES agents(id),   -- NULL if unknown agent
    session_id      UUID REFERENCES agent_sessions(id),
    event_type      TEXT NOT NULL CHECK (event_type IN (
        'auth_failure','replay_detected','stale_authorization',
        'catalog_integrity_violation','rate_limit_exceeded',
        'unauthorized_access','suspicious_pattern','policy_violation'
    )),
    severity        TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
    description     TEXT NOT NULL,
    source_ip       INET,
    details         JSONB DEFAULT '{}',
    request_id      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_security_type ON agent_security_events(event_type, created_at DESC);
CREATE INDEX idx_security_agent ON agent_security_events(agent_id, created_at DESC);
-- APPEND-ONLY
-- agent_id nullable: auth failures may come from completely unknown agents
-- severity enables filtering: dashboard shows 'critical' and 'high' prominently
```

---

## PHASE 8 — DOMAIN & APPLICATION CONTRACTS (PROPOSED)

### A. Proposed Service/Interface Architecture
We will use a strictly layered architecture internally:
1. **Protocol Layer (MCP Adapter)**: Parses JSON-RPC, handles protocol authentication.
2. **Application Layer**: Orchestrates use cases (e.g., `CheckoutUseCase`).
3. **Domain Layer**: Core business logic, rules, and invariants (e.g., `PolicyEngine`, `TransactionFSM`).
4. **Infrastructure Layer**: Database repositories, Razorpay adapter.

### B. Dependency Graph
```text
MCP Adapter
    │
    ▼
Application Services (CheckoutUseCase, AgentSessionUseCase)
    │
    ├──► Domain Services (PolicyEngine, IntegrityVerifier, TransactionFSM)
    │
    └──► Repository Interfaces (CatalogRepo, AuthRepo, TxRepo)
             │
             ▼
        Infrastructure (PostgreSQL, Redis, Razorpay API)
```

### C. Application-Layer Boundaries
The Application layer exposes **Use Cases**.
- `CheckoutUseCase`: Orchestrates integrity check, policy evaluation, authorization reservation, external Razorpay order creation, and authorization commit/release.
- `AgentSessionUseCase`: Orchestrates HMAC verification → session generation.
- `CatalogUseCase`: Handles product search and retrieval.
- `MerchantUseCase`: Handles merchant capability and policy discovery.
- `TransactionUseCase`: Handles transaction status retrieval.
**Rules**: Orchestrates multiple domain services and repositories. Begins/commits database transactions. **Never holds pure business rules.**

### D. Domain-Layer Boundaries
The Domain layer exposes **Business Rules** and **State Machines**.
- `PolicyEngine`: Evaluates a transaction against an authorization grant. Returns a structured `PolicyDecision`.
- `TransactionFSM`: Validates state transitions (`CREATED` → `AUTHORIZED`).
- `IntegrityVerifier`: Computes and compares catalog hashes to prevent LLM hallucinations or catalog poisoning.
**Rules**: Pure Go. Zero dependencies on Postgres or Razorpay. Highly testable.

### E. Repository Boundaries
Do NOT mirror tables. Repositories are bounded by aggregates:
- `CatalogRepository`: Owns `merchants`, `products`, `product_inventory`, `merchant_policies`. (Read-heavy).
- `AuthorizationRepository`: Owns `authorization_grants` and `authorization_usage`.
- `TransactionRepository`: Owns `transactions`, `transaction_events`, `idempotency_keys`.
- `AuditRepository`: Owns `audit_events`, `agent_security_events`, `policy_decisions`.
**Rules**: Repositories only return domain structs, not DB-specific structs.

### F. Payment-Provider Boundary
- **Interface**: `payment.Gateway`
- **Method**: `CreateOrder(ctx context.Context, amount int64, currency string, receiptID string) (GatewayOrder, error)`
- **Rule**: The domain knows nothing about Razorpay. Razorpay SDK is confined exclusively to `internal/infrastructure/razorpay`.

### G. MCP Boundary
- **Interface**: MCP is strictly an adapter. It implements the MCP JSON-RPC spec and maps `tools/call` to Application Layer use cases.
- **Rule**: MCP handlers must not contain logic like `if amount > limit`. They just call `CheckoutUseCase.Execute()`.

### H. Transaction/Unit-of-Work Strategy
**Recommendation: Context-based Transaction Manager.**
We will inject a `pgx.Tx` into `context.Context` via a `TransactionManager`.
- **Why?** It keeps repository method signatures clean (`CreateTransaction(ctx)` instead of `CreateTransaction(ctx, tx)`). If a `Tx` exists in `ctx`, the repo uses it; otherwise, it uses the connection pool. This is the idiomatic Go way to handle clean architecture transactions without leaking DB dependencies into the application layer.

### I. Error Hierarchy
1. **Infrastructure Error**: `pgx.ErrNoRows` (Never logged to user, wrapped immediately).
2. **Domain/Application Error**: `errors.NewNotFound("product not found", err)` (Logged internally with full trace).
3. **Protocol-Safe Error**: `{"code": 404, "message": "product not found"}` (Sent to MCP Agent).

### J. Request-Context Strategy
We will define strongly typed context keys in `pkg/context`:
`ctx = ctxutil.WithAgentID(ctx, "agent-123")`
`ctx = ctxutil.WithRequestID(ctx, "req-456")`
**Why?** Prevents massive function signatures. Repositories can automatically extract `AgentID` for audit logging without it being passed explicitly to every repository method.

### K. Idempotency Strategy
- **Where**: Enforced at the Application Layer (`CheckoutUseCase`) using the `idempotency_keys` table.
- **Behavior**: Returns the *original successful result* on duplicate request.
- **Why?** Network partitions happen. If an AI agent retries a payment, it should get the success response of the first attempt, not a "Conflict" error which would confuse its reasoning.

### L. Testability Strategy
All Domain and Application services will accept Interfaces (e.g., `CatalogRepository`). We will use `mockery` or hand-written mocks to test the `PolicyEngine` and `TransactionFSM` completely offline, instantly, without Postgres or Razorpay.

### M. Complete Interface List
1. `catalog.Repository` (Merchants, Products, Inventory, Policies)
2. `auth.Repository` (Agents, Sessions, Grants, Usage)
3. `transaction.Repository` (Transactions, Events, Idempotency)
4. `audit.Repository` (Audit, Security, Policy Logs)
5. `payment.Gateway` (Razorpay abstraction)
6. `auth.PolicyEngine` (Domain service)
7. `checkout.UseCase` (Application service)
8. `session.UseCase` (Application service)
9. `catalog.UseCase` (Application service)
10. `merchant.UseCase` (Application service)
11. `transaction.UseCase` (Application service)

### N. Example Method Signatures

```go
// Domain Service
type PolicyEngine interface {
    Evaluate(ctx context.Context, proposal PurchaseProposal, grant AuthGrant) (PolicyDecision, error)
}

// Application Service
type CheckoutUseCase interface {
    Execute(ctx context.Context, req CheckoutRequest) (CheckoutResponse, error)
}

// Repository
type AuthRepository interface {
    GetActiveGrant(ctx context.Context, agentID uuid.UUID) (*AuthGrant, error)
    ReserveUsage(ctx context.Context, grantID uuid.UUID, amount int64) error 
    CommitUsage(ctx context.Context, grantID uuid.UUID, amount int64) error 
    ReleaseUsage(ctx context.Context, grantID uuid.UUID, amount int64) error 
}
```

### O. Mapping from MCP Operations → Application Services
- `discover_merchant` → `merchant.UseCase.DiscoverCapabilities()`
- `search_products` → `catalog.UseCase.SearchProducts()`
- `get_product` → `catalog.UseCase.GetProduct()`
- `get_inventory` → `catalog.UseCase.GetInventory()`
- `get_policies` → `merchant.UseCase.GetPolicies()`
- `create_purchase_proposal` → `checkout.UseCase.Execute()` (Handles Integrity + Policy + Tx DB + Payment Gateway).
- `get_transaction_status` → `transaction.UseCase.GetStatus()`

### P. Example End-to-End Purchase Flow & Distributed State Machine
To guarantee financial consistency without holding a database transaction open across an external Razorpay network call, we use a Reservation (Saga-like) pattern.

**Phase 1: Reservation (Database Transaction 1)**
1. **MCP Adapter** calls `CheckoutUseCase.Execute()`.
2. **CheckoutUseCase** starts DB Transaction (Unit of Work).
3. **CheckoutUseCase** calls `CatalogRepo.GetProduct()` and `IntegrityVerifier.Verify()`.
4. **CheckoutUseCase** calls `AuthRepo.GetActiveGrant()` and `PolicyEngine.Evaluate()`.
5. **CheckoutUseCase** calls `AuthRepo.ReserveUsage()` (Atomic check: moves limit to `reserved_quantity`).
6. **CheckoutUseCase** calls `TxRepo.Create(status: CREATED)`.
7. **CheckoutUseCase** *commits DB Transaction*. (Lock is released instantly).

**Phase 2: External Payment Gateway (No DB Locks)**
8. **CheckoutUseCase** calls external `PaymentGateway.CreateOrder()`.

**Phase 3: Commit / Release (Database Transaction 2)**
9. **CheckoutUseCase** starts DB Transaction 2.
10. **If Razorpay Succeeded**: 
    - `AuthRepo.CommitUsage()` (Moves reserved to permanently consumed).
    - `TxRepo.Update(status: PAYMENT_PENDING)`.
11. **If Razorpay Failed or Timed Out**:
    - `AuthRepo.ReleaseUsage()` (Returns reserved amount back to available limit).
    - `TxRepo.Update(status: FAILED, reason: gateway_error)`.
12. **CheckoutUseCase** commits DB Transaction 2.
13. **CheckoutUseCase** returns result to **MCP Adapter**.

**Failure & Recovery Path**:
If the Go process crashes exactly during Phase 2 (after reserve, before commit/release), the system is left in `CREATED` with reserved funds. A background sweeper (Phase 13 Failure/Recovery) will find stale `CREATED` transactions, query Razorpay to see if the order exists, and either COMMIT (if found) or RELEASE (if missing/timed out).

### Q. Performance Implications
- The DB Transaction is strictly closed *before* making the external network call to Razorpay. This prevents database connection starvation under high concurrency.
- `AuthRepo.ReserveUsage` hides the atomic SQL update. The application layer does *not* do read-modify-write.
- Catalog searches bypass cross-domain orchestration, going straight to `CatalogUseCase` → `CatalogRepo` (which can be scaled via read-replicas).

### R. Security Implications
- The MCP adapter has no DB access, enforcing strict layer isolation.
- `IntegrityVerifier` prevents LLM hallucination of prices (catalog poisoning demo).
- All failed `PolicyEngine` evaluations automatically trigger an async call to `AuditRepo.RecordSecurityEvent()`.

### S. Alternatives Considered
- *Alternative 1*: Passing `*pgxpool.Pool` to every service. *Rejected*: Ties business logic directly to Postgres, breaking testability.
- *Alternative 2*: Thick Domain Models (Active Record). *Rejected*: Hard to maintain in Go; anemic models + robust domain services is more idiomatic for Go.

### T. Final Recommendation
Adopt the clean architecture boundaries described above. Use Context-based transaction management. Treat MCP strictly as an external transport adapter, identical in privilege to a REST handler.

---

## PHASE 9 — AGENT CONTRACT (MCP) (PROPOSED)

### A. Transport Architecture
**MCP Streamable HTTP** is the primary transport.
- Uses stateless HTTP POST requests for commands/queries.
- Uses short-lived Server-Sent Events (SSE) ONLY when server-to-client streaming is required within a specific request lifecycle.
- *Why?* Enables standard HTTP horizontal scaling, load balancing, and eliminates the connection-overhead and statefulness of permanently open legacy SSE connections.

### B. Authentication Architecture
Strict separation between Protocol Auth and Application Auth:
1. **MCP HTTP Auth**: The transport layer intercepts the request and extracts the credential (e.g., `Authorization: Bearer <token>`).
2. **App Auth Mapping**: The Application Layer (`AgentSessionUseCase`) maps the `token` to an internal `session_id` and strongly-typed `agent_id`.
3. **Result**: The MCP routing handlers never deal with HMAC or cryptography; they only pass the HTTP header value to the Use Case, which returns the verified Agent identity context.

### C. Resource Architecture
Resources are strictly for relatively stable, merchant-level context. 
- `merchant://{merchant_id}/capabilities`
- `merchant://{merchant_id}/policies`
**Rule**: Do NOT expose the entire catalog as a Resource. Catalogs are too large for LLM context windows and update frequently.

### D. Tool Architecture
Tools are for dynamic queries and state-changing operations. 
Tools are strictly mapped to Application Use Cases. The LLM invokes tools, and the MCP adapter translates these into Use Case executions.

### E. Complete Tool Schemas

**1. `search_products`**
- **Purpose**: Search the merchant catalog.
- **Input**: `{"query": "string (opt)", "category": "string (opt)", "max_price": "int (opt)"}`
- **Output**: `[{"id": "uuid", "name": "str", "price": 450, "catalog_version_id": "uuid", "product_hash": "str"}]`

**2. `get_product`**
- **Purpose**: Retrieve specific product details and inventory.
- **Input**: `{"product_id": "uuid"}`
- **Output**: `{"id": "uuid", "price": 450, "inventory": 10, "catalog_version_id": "uuid", "product_hash": "str"}`

**3. `create_purchase_proposal`**
- **Purpose**: Propose a purchase for authorization and integrity checks. (Does NOT execute payment).
- **Input**: `{"product_id": "uuid", "quantity": "int", "expected_price": "int", "catalog_version_id": "uuid", "product_hash": "str", "proposal_idempotency_key": "uuid"}`
- **Output**: `{"proposal_id": "uuid", "status": "AUTHORIZED", "policy_decision": {...}}`

**4. `execute_payment`**
- **Purpose**: Execute the payment for an authorized proposal.
- **Input**: `{"proposal_id": "uuid", "payment_idempotency_key": "uuid"}`
- **Output**: `{"transaction_id": "uuid", "status": "PAYMENT_PENDING", "gateway_order_id": "str"}`

### F. Tool Risk Classification
Every financial tool must pass through: `Authentication → Authorization → Integrity → Policy → Idempotency → Transaction FSM → Payment Gateway`.
- **READ (Low Risk)**: `search_products`, `get_product`, `discover_merchant`, `get_policies`. Requires AuthN.
- **PROPOSAL (Medium Risk)**: `create_purchase_proposal`. Requires AuthN + AuthZ (Policy Engine) + Integrity Verification.
- **FINANCIAL_ACTION (High Risk)**: `execute_payment`. Requires AuthN + Valid Authorized Proposal + Idempotency + Transaction FSM + Payment Gateway.

### G. Integrity Protocol
The LLM is NEVER the authority for catalog integrity.
1. Agent provides `product_id`, `catalog_version_id`, and `product_hash` in `create_purchase_proposal`.
2. Application (`IntegrityVerifier`) independently loads the product and the exact catalog version from the DB.
3. Application computes the canonical hash: `SHA256(product_id + expected_price + currency + catalog_version_id)`.
4. Application compares its computed hash with the agent's hash.
5. If mismatch -> Reject with `IntegrityViolationError`.

### H. Idempotency Protocol
Idempotency is strictly scoped into two independent domains: `proposal_idempotency_key` and `payment_idempotency_key`. The **calling agent/client software** (not the reasoning LLM) generates these UUIDs.

**Proposal Scope**:
- `same proposal key + same proposal` = return original `proposal_id` and `AUTHORIZED` status.
- `same proposal key + different proposal` = 409 Conflict.

**Payment Scope**:
- `same payment key + same payment` = return original `transaction_id` and `PAYMENT_PENDING` status.
- `same payment key + different payment` = 409 Conflict.

Enforced at the Application Layer before touching the database, preventing a single generic UUID namespace from causing cross-tool collisions.

### I. Proposal → Authorization → Payment Flow
Explicit separation of reasoning from execution:
1. **Discover/Search**: Agent calls `search_products`.
2. **Proposal**: Agent calls `create_purchase_proposal`. System checks policies, reserves authorization usage, returns `AUTHORIZED` state.
3. **Payment**: Agent calls `execute_payment`. System creates external Razorpay order. If successful, commits usage. If failed, releases usage.

### J. Security Threat Model
- **Compromised Agent**: Detection via unusual policy denials. Mitigation: Usage limits, revoke session. Audit event: `authorization_denied`.
- **Prompt Injection via Product Data**: Detection via rigorous LLM output parsing. Mitigation: MCP server strictly enforces JSON schemas. Audit event: `schema_validation_failed`.
- **Product Hash Tampering**: Detection via `IntegrityVerifier`. Mitigation: Reject proposal. Audit event: `integrity_violation`.
- **Idempotency Key Reuse w/ Modified Request**: Detection via Idempotency table constraints comparing request payload hashes. Mitigation: Reject request. Audit event: `idempotency_conflict`.

### K. Error Model
Errors must be protocol-safe mapping from domain errors:
- `AuthenticationError` (401)
- `AuthorizationError` (403)
- `PolicyDeniedError` (403)
- `IntegrityViolationError` (422)
- `DuplicateRequestError` (409)

### L. Performance Model
- **Connection Handling**: Stateless HTTP requests. Extremely high concurrency. No permanent SSE socket limits.
- **Database Round Trips**: Reads use Replicas (CatalogRepo). Writes use fast path with minimal lock times.

### M. Complete MCP → Application Service Mapping
- `discover_merchant` → `merchant.UseCase.GetCapabilities()`
- `get_policies` → `merchant.UseCase.GetPolicies()`
- `search_products` → `catalog.UseCase.SearchProducts()`
- `get_product` → `catalog.UseCase.GetProduct()`
- `create_purchase_proposal` → `checkout.UseCase.CreateProposal()`
- `execute_payment` → `checkout.UseCase.ExecutePayment()`

### N. Example End-to-End MCP Interaction
1. **Agent** sends HTTP POST to `/mcp/tools/call/search_products`.
2. **Server** validates token, calls `catalog.UseCase`, returns products.
3. **Agent** decides to buy. Sends HTTP POST to `/mcp/tools/call/create_purchase_proposal` with `product_hash` and `proposal_idempotency_key`.
4. **Server** validates integrity, reserves auth, returns `AUTHORIZED` proposal.
5. **Agent** sends HTTP POST to `/mcp/tools/call/execute_payment` with `payment_idempotency_key`.
6. **Server** calls Razorpay, commits auth, returns `transaction_id`.

### O. Failure Scenarios
- **Session Expiry During Tx**: Agent token expires between proposal and payment. Agent must re-authenticate and retry `execute_payment` with same `payment_idempotency_key`.
- **Razorpay Timeout**: System does NOT automatically release the authorization reservation. A timeout means the state is ambiguous.
  - Razorpay request → TIMEOUT → Transaction enters `PAYMENT_STATUS_UNKNOWN`.
  - A background reconciliation job queries Razorpay using the `idempotency_key` or `receipt_id`.
  - Confirmed success → Commit reservation, proceed to `PAYMENT_PENDING`.
  - Confirmed absence/failure → Release reservation, mark `FAILED`.
  - Otherwise → Remain in recoverable `UNKNOWN` state. The system prefers reconciliation over guessing in ambiguous payment states.

### P. Alternatives Considered
- *Legacy HTTP+SSE*: Rejected due to high connection overhead and poor load-balancing for 100,000+ concurrent agents.
- *LLM Generates Idempotency Key*: Rejected. LLMs are non-deterministic. The deterministic client framework wrapping the LLM must handle idempotency key injection.

### Q. Final Recommendation
Use MCP Streamable HTTP. Enforce strict Idempotency via client-generated keys. Implement the strict two-step Proposal → Payment flow to isolate LLM reasoning from actual financial execution.

---

## PHASE 10 — FINALIZED STRATEGY (APPROVED 2026-08-28)

### 10.1 MVP Core Scope (APPROVED)

The following 18 capabilities define the MVP. Nothing outside this list will be implemented unless explicitly justified and approved.

1. Agent identity / authentication
2. Delegated authorization (grants, usage tracking)
3. Merchant / catalog management
4. Catalog integrity verification
5. MCP server (Streamable HTTP, scoped tool set)
6. Deterministic policy engine
7. Purchase proposal flow
8. Payment execution flow
9. Razorpay integration (Orders API, Payments API, Webhooks)
10. Transaction FSM (state machine with valid transitions)
11. Idempotency (proposal-scoped and payment-scoped)
12. Webhook handling (signature verification, deduplication)
13. Recovery / reconciliation (stale transactions, unknown payment states)
14. Audit trail (structured, append-only)
15. Security attack demonstrations
16. AI buyer agent simulator
17. Merchant trust console (frontend)
18. Performance measurement (real benchmarks, not fabricated)

### 10.2 Explicitly Out of Scope (FUTURE / ARCHITECTURE-READY)

These will NOT be implemented. The architecture should not prevent them, but no code will be written for them:

- ACP / UCP / AP2 full protocol compliance
- Cross-protocol security
- Agent reputation system
- Trajectory verification
- Autonomous dispute evidence
- Advanced fraud detection (ML-based)
- Economic manipulation detection
- Advanced multi-tenancy (teams, org management, billing)
- Production-scale orchestration (Kubernetes, etc.)

---

### 10.3 AI Architecture Rules (APPROVED)

**The LLM is NOT trusted.** This is an invariant that must never be violated.

**The LLM MAY:**
- Understand natural-language intent
- Reason about products and user needs
- Select tools via function calling
- Retrieve information
- Propose products to the user
- Produce structured proposals

**The LLM MAY NOT:**
- Authorize payment
- Determine spending limits
- Modify authorization grants
- Bypass the policy engine
- Decide whether a transaction is valid
- Directly call Razorpay
- Modify catalog integrity records

**Canonical trust flow:**

```
LLM → PROPOSAL → DETERMINISTIC VALIDATION → POLICY → AUTHORIZATION → TRANSACTION FSM → PAYMENT
```

**Minimize LLM calls.** The LLM should only handle tasks that deterministic code cannot:
- Natural-language understanding and intent interpretation
- Semantic reasoning and tool selection
- Ambiguous natural-language tasks

**Deterministic code handles:**
- Price calculations
- Spending limit checks
- Inventory lookups
- Catalog hash verification
- Authorization decisions
- State machine transitions

### 10.4 Token Efficiency Rules (APPROVED)

Token usage is an engineering resource, not an afterthought.

1. **Compact tool outputs.** Return only fields the LLM needs for reasoning. No verbose messages, no internal metadata.
2. **Filter before LLM.** Never send 10,000 products to the LLM. Use database filtering → small candidate set → LLM.
3. **Minimal context.** Do not inject entire policy documents when only the return policy is relevant.
4. **MCP tool schemas.** Every tool defines minimal input/output schemas, pagination, filtering, and maximum result sizes.
5. **System prompt efficiency.** Keep system prompts focused. No redundant instructions.
6. **Model routing readiness.** Architecture allows routing different task complexities to different model tiers. MVP uses single model (Gemini 2.5 Flash).

### 10.5 RAG Strategy (APPROVED)

RAG will be used only where it adds genuine value:
- Merchant policy retrieval (natural-language queries)
- Natural-language product discovery
- Merchant knowledge base

**Deterministic systems remain authoritative for:** price, inventory, quantity, spending limits, authorization, payment, transaction state.

**RAG architecture decision:** Start with PostgreSQL full-text search. Only introduce pgvector or a dedicated vector database if evaluation demonstrates meaningful retrieval quality improvement over full-text search.

---

### 10.6 Product Experience Plan (APPROVED)

The final product must feel like a real platform, not "backend + random dashboard." The experience must communicate the product thesis immediately:

> AI agents can transact with merchants, but the merchant controls the trust boundary around money.

#### A. Merchant Trust Console

Dashboard showing:
- Merchant AI-readiness status
- MCP server status and connected agents
- Catalog integrity status (hash verification)
- Active agent sessions and activity
- Policy decisions (allow/deny with reasoning)
- Transaction activity (real-time or near-real-time)
- Security events (auth failures, replay attempts, integrity violations)

#### B. AI Buyer Simulator

Interactive demonstration showing the complete flow:

```
User Intent → AI Agent → MCP → Trust Layer → Policy → Authorization → Payment → Result
```

Judges can observe each step in the pipeline with structured output at every stage.

#### C. Security Attack Lab

Demonstrable attack scenarios with real code behind them:

| # | Attack | Expected Result |
|---|--------|----------------|
| 1 | Unauthorized agent | DENIED — agent not recognized |
| 2 | Expired authorization | DENIED — grant expired |
| 3 | Replay attack | Original result returned, no duplicate action |
| 4 | Duplicate payment | Original transaction returned, no duplicate charge |
| 5 | Idempotency conflict | REJECTED — same key, different payload |
| 6 | Catalog tampering | INTEGRITY VIOLATION — hash mismatch, payment NOT executed |
| 7 | Prompt injection | Structured output validation catches malicious content |
| 8 | Webhook replay | Deduplicated — already processed |
| 9 | Policy violation (over-limit) | DENIED — amount exceeds authorization |

#### D. Transaction Timeline

Visual timeline showing the complete lifecycle:

1. Agent authentication
2. Product discovery (MCP tool call)
3. Integrity verification (hash check)
4. Policy evaluation (structured decision)
5. Authorization reservation
6. Transaction creation
7. Razorpay order creation
8. Payment execution
9. Webhook receipt and verification
10. Completion or recovery

#### E. Architecture Visualization

Visual representation of the system architecture for judges to understand the layered trust model.

#### F. Performance Dashboard

Real measured values (NEVER fabricated):
- Throughput (requests/sec)
- p50 / p95 / p99 latencies
- Error rate
- Database query latency
- Critical-path latency breakdown

Clearly distinguished: TARGET vs MEASURED RESULT.

#### G. Demo Mode

Deterministic demo mode that exercises real application logic without depending entirely on external network/model behavior. Uses pre-recorded or mock LLM responses and simulated Razorpay interactions to ensure reliable demonstrations.

---

### 10.7 Security Strategy (APPROVED)

**Principle: Fail closed. Never guess on financial state.**

| Condition | Result |
|-----------|--------|
| Unknown agent | DENY |
| Expired authorization | DENY |
| Invalid catalog hash | DENY |
| Policy violation | DENY |
| Invalid state transition | DENY |
| Idempotency conflict | DENY |
| Invalid webhook signature | REJECT |
| Unknown payment state | RECONCILE (never assume timeout = failure) |

**Threats addressed in MVP:**

| Threat | Mitigation |
|--------|-----------|
| Prompt injection via catalog | Sanitize catalog before LLM exposure; structured data only to policy engine |
| Indirect prompt injection | LLM output goes through deterministic validation, never directly to payment |
| Tool poisoning | MCP tools are server-defined, not agent-defined |
| Unauthorized agent | HMAC-based auth, server-side verification |
| Session theft/expiry | Time-bounded sessions, hash-stored tokens |
| Replay attack | Nonce tracking + idempotency keys |
| Duplicate payment | Idempotency + unique constraints |
| Catalog tampering | Content hashing, integrity verification at purchase time |
| Authorization abuse | Atomic SQL reservation, time bounds, spending limits |
| Webhook spoofing | HMAC-SHA256 signature verification |
| Webhook replay | Event ID deduplication |

---

### 10.8 Reliability Strategy (APPROVED)

| Scenario | Handling |
|----------|---------|
| Transaction recovery | Background sweeper finds stale CREATED transactions, reconciles with Razorpay |
| Razorpay timeout / unknown | Transaction enters PAYMENT_STATUS_UNKNOWN, reconciliation queries Razorpay |
| Reconciliation | Background job queries Razorpay by receipt_id/idempotency_key |
| Webhook verification | HMAC-SHA256 of raw body before processing |
| Webhook deduplication | razorpay_event_id UNIQUE constraint |
| Out-of-order events | State machine rejects invalid transitions; event ordering verified |
| Retry strategy | Exponential backoff for non-financial operations; reconciliation for financial operations |
| Failure states | Explicit FAILED, PAYMENT_FAILED, PAYMENT_STATUS_UNKNOWN states in FSM |

**Critical rule:** Never hold a PostgreSQL transaction open while waiting on Razorpay. External payment calls are handled through the reservation-based saga pattern (Phase 8, Section P).

**Critical rule:** Never retry financial operations blindly. UNKNOWN ≠ FAILURE.

---

### 10.9 Performance Strategy (APPROVED)

**Principle: Design for performance, measure before optimizing.**

#### Performance Targets (NOT YET MEASURED)

| Operation | Target p95 |
|-----------|-----------|
| MCP read operation (search_products, get_product) | < 50ms |
| Policy evaluation | < 10ms |
| Database authorization check | < 5ms |
| End-to-end proposal (excluding external LLM) | < 100ms |
| Order creation (including Razorpay) | < 500ms |
| Webhook processing | < 100ms |
| Full purchase flow E2E | < 1s (excluding LLM latency) |

#### Database Round-Trip Budgets

| Operation | Expected DB Round Trips | Notes |
|-----------|------------------------|-------|
| Product search | 1 | Single query with JOIN to inventory |
| Get product | 1 | Single query with JOIN to inventory |
| Proposal (CreateProposal) | 4-5 | Idempotency check, product lookup, grant lookup, reserve usage, create transaction |
| Payment (ExecutePayment) | 3-4 | Idempotency check, load transaction, (Razorpay call), update status + commit usage |
| Webhook processing | 2-3 | Dedup check, insert event, update transaction status |

#### Architectural Performance Decisions

- **Stateless application layer** — multiple Go instances can share the same DB/Redis
- **Connection pooling** — pgxpool with configured min/max connections
- **PostgreSQL indexing** — targeted indexes on hot query paths
- **Redis only where justified** — idempotency hot path, rate limiting, session cache
- **Minimal network round trips** — batch where possible without sacrificing clarity
- **Concurrency safety** — atomic SQL operations over application-level locking
- **Horizontal-scaling-ready** — merchant_id as natural shard key

#### Hot Rows and Contention Points

| Row | Contention Level | Mitigation |
|-----|-----------------|-----------|
| authorization_usage | HIGH (updated every transaction) | Atomic SQL UPDATE with condition (microsecond lock) |
| product_inventory | MEDIUM (updated on purchase) | Atomic SQL UPDATE with quantity check |
| transaction status | LOW (each transaction updated few times) | Standard row-level lock |
| idempotency_keys | LOW (insert once, read once) | UNIQUE constraint handles races |

---

### 10.10 Efficiency Principles (APPROVED)

These principles govern all implementation decisions:

1. **Every LLM call must justify its token cost.** If deterministic code can do it, don't use the LLM.
2. **Every database query must justify its latency.** No SELECT *, no N+1, project only required columns.
3. **Every network call must justify its failure risk.** Define timeout, retry policy, backoff, failure behavior.
4. **Every abstraction must justify its complexity.** If it doesn't improve correctness, security, latency, scalability, reliability, developer experience, or product value — don't add it.
5. **Every security control must justify the threat it mitigates.**
6. **Every product feature must justify its value to the competition/demo.**
7. **Every cache must define** TTL, invalidation strategy, consistency model, stale-data behavior, memory impact, failure behavior. Never cache financial authorization state.
8. **Memory efficiency.** Pagination, streaming, bounded buffers, explicit limits. No unbounded requests.
9. **Frontend performance.** Optimize bundle size, lazy loading, API payload size. Real-time updates only where they provide meaningful UX value.

**Optimization workflow:** DESIGN → MEASURE → IDENTIFY BOTTLENECK → OPTIMIZE → MEASURE AGAIN

---

### 10.11 Testing Strategy (APPROVED)

#### Unit Tests
- Policy engine (all rule combinations)
- Authorization checks (limit, expiry, category)
- Transaction FSM (all valid/invalid transitions)
- Integrity verifier (hash generation, verification, mismatch)
- Idempotency logic
- Error mapping

#### Integration Tests
- PostgreSQL repository operations
- Redis operations (where used)
- Razorpay adapter (mock/test mode)
- Webhook processing pipeline
- MCP server tool calls

#### Concurrency Tests
- Simultaneous authorization usage (race condition on spending limits)
- Duplicate transaction attempts
- Inventory contention (concurrent purchases)
- Webhook duplicates (at-least-once delivery)
- Concurrent state transitions

#### Security Tests
Every attack scenario in the Security Attack Lab (Section 10.6.C) must have an automated test:
- Unauthorized agent → DENY
- Expired authorization → DENY
- Replay attack → return original
- Duplicate payment → return original
- Idempotency conflict → REJECT
- Catalog tampering → INTEGRITY VIOLATION
- Webhook replay → deduplicated
- Policy violation → DENY

#### End-to-End Tests

**Success path:**
Agent → MCP → Catalog → Integrity → Policy → Authorization → Transaction → Razorpay → Webhook → Completed

**Failure paths:**
- Unauthorized agent
- Stale authorization
- Catalog modification between discovery and purchase
- Duplicate request
- Duplicate webhook
- Razorpay timeout → UNKNOWN → reconciliation
- Invalid state transition

---

### 10.12 Observability Strategy (APPROVED)

Every important operation must be traceable using structured logging with:
- Request ID
- Agent ID
- Session ID
- Merchant ID
- Transaction ID
- Proposal ID

**Structured logging** via `slog` (Go standard library) with JSON output.

**LLM observability** (where applicable):
- Model name
- Request type
- Input/output token counts
- Latency
- Tool-call count
- Retrieved context size

**NEVER log:** API keys, bearer tokens, HMAC secrets, sensitive payment information, unnecessary prompt contents.

---

### 10.13 Competition Demo Plan (APPROVED)

The final demo tells a story through 5 scenarios, all backed by real code:

#### Demo 1 — Legitimate Agent Purchase
User: "Find running shoes under ₹5,000."
Flow: Agent → search → verify integrity → propose → authorize → payment → completed.
**Shows:** Full happy-path trust pipeline working end-to-end.

#### Demo 2 — Malicious / Compromised Agent
Agent attempts ₹12,000 purchase. Authorization limit: ₹5,000.
**Result:** DENIED with structured policy reasoning.
**Shows:** Deterministic policy enforcement prevents unauthorized spend.

#### Demo 3 — Catalog Tampering
Product price changes between discovery and purchase.
**Result:** Integrity violation. Payment NOT executed.
**Shows:** Catalog integrity verification prevents LLM hallucination or poisoning attacks.

#### Demo 4 — Replay / Duplicate
Same request repeated with same idempotency key.
**Result:** Original result returned. No duplicate payment.
**Shows:** Idempotency prevents duplicate charges.

#### Demo 5 — Payment Uncertainty
Razorpay response times out.
**Result:** Transaction enters UNKNOWN state. Reconciliation occurs. System does NOT blindly assume failure.
**Shows:** Financial safety — the system never guesses on payment state.

---

### 10.14 Architectural Rules (APPROVED)

#### Database Access Rule
```
MCP → Application → Domain → Repository Interface → PostgreSQL Implementation
```
No direct DB access from MCP handlers, LLM code, domain logic, or frontend.

#### Payment Rule
Never hold a PostgreSQL transaction open while waiting on Razorpay. Use the reservation-based saga pattern. Payment uncertainty is represented explicitly. Never assume timeout = failure.

#### Frontend Rule
Frontend NEVER implements its own security/business logic. It is a client of the application layer. No frontend-only authorization, payment decisions, spending-limit calculations, or transaction-state mutation. The backend is authoritative.

#### MCP Rule
MCP is a protocol adapter. It MUST NOT contain business logic. Correct: MCP → Application Use Case → Domain → Repository. Incorrect: MCP → PostgreSQL or MCP → "if amount > limit then deny".

#### Complexity Budget
Treat complexity as a resource. Before adding any component, it must meaningfully improve correctness, security, latency, scalability, reliability, developer experience, or product value. Prefer one PostgreSQL instance over PostgreSQL + Redis + Elasticsearch + Kafka + vector DB unless each component has a demonstrated purpose.

---

### 10.15 Decision Approval System (APPROVED)

Every significant architectural decision must be classified:

| Status | Meaning |
|--------|---------|
| PROPOSED | Under consideration, not yet approved |
| APPROVED | Reviewed and accepted |
| REJECTED | Considered and declined |
| SUPERSEDED | Replaced by a later decision |

Decisions affecting architecture, security, database, protocol, performance, scalability, AI behavior, payment, or product scope must be explained and approved before implementation.

---

### 10.16 Code Quality Rules (APPROVED)

All code must be:
- Idiomatic Go
- Readable and maintainable
- Testable (interfaces for all external dependencies)
- Production-oriented
- Minimal (no premature abstractions)
- Explicit where correctness matters

Avoid:
- Premature abstractions and unnecessary interfaces
- Giant files and giant functions
- Hidden global state and magic values
- Unnecessary dependencies, goroutines, reflection, and frameworks

**Every abstraction must earn its existence.**

---

### 10.17 Implementation Workflow (APPROVED)

For every implementation step:

```
STEP N — <NAME>
├── Goal: What we are building
├── Why: Why this component exists
├── Architecture: Where it fits
├── Files: What to create/modify (1-3 files max per step)
├── Code: Exact code to implement
├── Explanation: Structs, interfaces, methods, dependencies, error handling,
│   concurrency, performance, security
├── How to Run: Verification commands
├── Expected Result: What I should see
├── Test: How to test it
├── Interview Explanation: How to explain in an interview
└── STOP: Wait for confirmation
```

**Small increments only.** 1-3 files per step. Understand each layer before moving forward.

---

### 10.18 Schema Corrections Required (IDENTIFIED)

The following contradictions between Phase 7 schemas and the previous implementation were identified during the project reset. These must be resolved during the fresh schema design:

1. **authorization_usage needs `amount_reserved` column** — Required by the reservation pattern (Phase 8, Section P)
2. **Column naming consistency** — Decide between `price_amount` vs `price`, `max_amount` vs `max_limit`, `used_amount` vs `amount_consumed`
3. **Products: `is_active` BOOLEAN vs `status` TEXT** — Pick one pattern and use it consistently
4. **Idempotency table design** — Align DB schema with application-layer idempotency protocol
5. **Transactions table** — Decide whether `razorpay_order_id` lives on the `transactions` table or only in the separate `razorpay_orders` table

**These will be resolved during Phase A (Foundation) of the implementation roadmap.**

---

## Implementation Roadmap

| Phase | Description | Estimated Steps |
|-------|-------------|----------------|
| A — Foundation | Go module, directory structure, config, logging, DB connection, Docker Compose | 3-4 |
| B — Domain Core | Domain types, Transaction FSM, Policy Engine, Integrity Verifier, Errors, Context utilities | 5-6 |
| C — Data Layer | Corrected SQL schema, Repository interfaces, Catalog/Auth/Transaction PostgreSQL repos | 4-5 |
| D — Application Layer | Transaction Manager, Checkout UseCase (Proposal + Payment), Catalog/Merchant UseCases | 3-4 |
| E — Payment Gateway | Payment Gateway interface, Razorpay adapter, Webhook handler | 2-3 |
| F — MCP Server | MCP server setup, Read tools, Financial tools, Agent auth middleware | 3-4 |
| G — AI Layer | LLM provider interface, Gemini adapter, Buyer agent simulator | 2-3 |
| H — Frontend | React (Vite) setup, Merchant Trust Console, Transaction Timeline, Security Attack Lab, Performance Dashboard | 3-4 |
| I — Testing & Demo | Unit tests, Integration tests, Security attack demonstrations, E2E demo flows | 3-4 |
| J — Polish | Load testing, Performance measurement, Observability, Demo mode, Competition video prep | 2-3 |

**Total estimated steps: ~35-40**

Each step follows the guided workflow (Section 10.17): Goal → Why → Architecture → Files → Code → Explain → Run → Test → Interview → STOP.

---

## Planning Roadmap

| Phase | Status |
|-------|--------|
| 0 — Understanding | ✅ COMPLETE |
| 1-6 — Product/Architecture | ✅ COVERED |
| 7 — Data Model | ✅ APPROVED (schema corrections identified) |
| 8 — Domain & Application Contracts | ✅ APPROVED |
| 9 — Agent Contract (MCP) | ✅ APPROVED |
| 10 — Finalized Strategy | ✅ APPROVED (2026-08-28) |
| A — Foundation | ⬜ READY TO START |
| B — Domain Core | ⬜ |
| C — Data Layer | ⬜ |
| D — Application Layer | ⬜ |
| E — Payment Gateway | ⬜ |
| F — MCP Server | ⬜ |
| G — AI Layer | ⬜ |
| H — Frontend | ⬜ |
| I — Testing & Demo | ⬜ |
| J — Polish | ⬜ |

---

## CHANGELOG

| Version | Date | Changes |
|---------|------|---------|
| 0.1-draft | 2026-08-22 | Initial first-pass with research, hypotheses, 5 proposed decisions |
| 0.2 | 2026-08-22 | Decisions 001-006 APPROVED. MVP scope expanded. React frontend added. Deadline confirmed Sept 5. |
| 0.3 | 2026-08-22 | DECISION-007 APPROVED. MCP server as primary agent interface (scoped subset). Protocol strategy updated. |
| 0.4 | 2026-08-22 | DECISION-008 APPROVED. Gemini 2.5 Flash with provider-agnostic abstraction. Free-tier limits verified. |
| 0.5 | 2026-08-22 | Phase 7 data model analysis: 20 entities, 14 analytical questions addressed. |
| 0.6 | 2026-08-22 | Phase 7 detailed schema: all 20 tables with columns, types, constraints, indexes, and design rationale. |
| 0.7 | 2026-08-22 | Phase 8 Domain & Application Contracts conceptual design approved with Reservation Pattern and Strict Use Case boundaries. |
| 0.8 | 2026-08-22 | Phase 9 Agent Contract (MCP) conceptual design approved with scoped idempotency and Razorpay Timeout reconciliation. |
| 1.0 | 2026-08-28 | **PROJECT RESET.** All implementation files deleted. Phase 10 finalized strategy added: MVP scope rule, AI architecture rules, token efficiency, RAG strategy, product experience plan (console, simulator, attack lab, timeline, visualization, performance dashboard, demo mode), security strategy, reliability strategy, performance strategy (targets, DB round-trip budgets, hot rows), efficiency principles, testing strategy, observability strategy, competition demo plan (5 scenarios), architectural rules, decision approval system, code quality rules, implementation workflow, schema corrections identified, implementation roadmap (10 phases, ~40 steps). |

