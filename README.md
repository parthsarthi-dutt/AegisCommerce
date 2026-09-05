# AegisCommerce: The Future of Agentic Commerce
*Making merchants sellable to AI buyers and turning conversational AI into an autonomous revenue growth engine.*

---

## 📖 The Open Problem: The Agentic Commerce Era
We are witnessing a paradigm shift. With the rapid evolution of agent-to-agent protocols (like UAP, ACP, AP2) and the global protocol race, AI agents are transitioning from mere chatbots into fully autonomous buyers, negotiators, and sellers. 

However, a massive barrier remains: **The Trust Gap**. 
If a merchant exposes their catalog to an AI buyer, how do they ensure the AI doesn't hallucinate a ₹10,000 product as a ₹1 purchase? If an LLM is granted an operating budget, how do we prevent a simple retry-loop bug from accidentally executing ten identical payments and draining the budget? 

**AegisCommerce** was engineered specifically to solve this open problem. It is a comprehensive, end-to-end framework that turns AI agents into trusted revenue generators. It allows merchants to make their entire catalog structurally **Agent-Readable**, orchestrates intelligent **Conversational In-App Checkout**, and strictly enforces the ultimate rule of autonomous commerce: 

> **Every single money action must be explainable, bounded, and gated.**

---

## 🚀 The Narrative: Driving Merchant Revenue

### 1. The Conversational Upsell (Growing the Basket Size)
The customer journey begins on the frontend with the **AI Revenue Agent**. When a buyer expresses intent to purchase a base product (e.g., an *"AI Developer Plan"*), the agent doesn't just passively process it. 

It actively works to grow the merchant's revenue. By analyzing the context, it recognizes that an AI Developer Plan pairs perfectly with a Vector Database. It seamlessly suggests highly relevant cross-sells (like *Vector DB Credits* and *Compute Capacity*), assembling them into an atomic, multi-item bundle for a seamless checkout experience. 

This translates to higher average basket sizes and immediate, measurable revenue lift for the merchant.

### 2. The Trust Layer: Bounded & Gated Execution
Once the agent proposes this financial action, the raw LLM output hits the **Trust Layer**—a deterministic Go monolith acting as the immutable gatekeeper. The LLM is strictly decoupled from the physical payment rails. 

- **Agent-Readable Catalog Integrity:** The AI passes cryptographic hashes of the products it intends to buy. The Trust Layer verifies these against a secure ground-truth database. If an LLM hallucinates a lower price, modifies a decimal, or alters an SKU to bypass restrictions, the transaction is forcefully rejected. The backend acts as the absolute source of truth.
- **Deterministic Policy Limits:** Every agent operates under a strict, immutable spending budget (Authorization Grant). The Trust Layer evaluates if the total bundle exceeds the limit. If it does, the intent is bounded and denied immediately. The agent simply cannot spend what it does not have.
- **Distributed Idempotency Engine:** AI agents can stutter, enter infinite loops, or fire duplicate network events. The backend uses strict distributed idempotency locks (backed by PostgreSQL/Redis) to guarantee exactly-once execution. A duplicate intent is recognized, the execution is halted, and the original transaction state is gracefully returned.

### 3. The Reservation-Based Saga (Handling Failures Gracefully)
Financial state transitions are delicate, and network partitions happen. AegisCommerce implements a robust Reservation Saga (a Finite State Machine) to handle these failures gracefully without causing budget leaks.

- **Phase 1: Proposing:** The agent's intent is recorded as `AUTHORIZED` if policy checks pass. No funds are blindly locked yet.
- **Phase 2: Execution & Reservation:** Only when the final physical gateway checkout executes are the agent's funds atomically locked (`amount_reserved`). This prevents a user's budget from being artificially drained just because they opened a checkout window.
- **Phase 3: The Goroutine Sweeper:** If a user abandons a checkout window, or if a webhook fails to arrive due to a network partition, a background Goroutine Sweeper actively patrols the database. Stale `authorized` or `payment_pending` transactions are gracefully expired after a set threshold (e.g., 30 days). Reserved limits are safely released back to the agent's pool. **One failure handled gracefully.**

### 4. Full Auditability: Every Action Explainable
A core requirement for agent-to-agent commerce is absolute transparency. Human operators must be able to trust the machine. AegisCommerce features an **Interactive Command Center** that acts as the single pane of glass:
- **Live Telemetry:** Tracks true merchant revenue lift based *only* on successfully captured transactions, isolating the incremental revenue driven purely by the AI's cross-selling capabilities.
- **Immutable Audit Trail:** Every single system decision—from allowed checkouts to blocked security threats—is recorded in a tamper-proof ledger. If an agent is blocked, the audit log explains *exactly why* (e.g., "Insufficient remaining authorization limit").

---

## 🛡️ The Security Attack Lab (Proving the Defenses)
To definitively prove that the Trust Layer is impenetrable and handles edge-case failures gracefully, AegisCommerce ships with a built-in **Threat Simulation Lab** accessible right from the dashboard.

1. **Rogue Agents (Identity Spoofing):** 
   - *The Threat:* A malicious or unauthenticated script attempts to push a transaction to the backend. 
   - *The Defense:* Blocked instantly by strict authentication mapping. The agent UUID must hold a valid, active grant.
2. **Catalog Poisoning (Price Tampering):** 
   - *The Threat:* An LLM is prompt-injected into generating a payload where a ₹10,000 laptop is priced at ₹1. 
   - *The Defense:* Intercepted by Cryptographic Hash Integrity. The payload hash will not match the backend's ground-truth hash for that SKU.
3. **Over-Limit Spending:** 
   - *The Threat:* An agent goes rogue and attempts to purchase 10,000 units of a product, massively exceeding its budget. 
   - *The Defense:* Denied gracefully by the Policy Engine. The requested payload is checked against `amount_consumed + amount_reserved`. 
4. **Replay Attacks (Duplicate Intents):** 
   - *The Threat:* An agent gets stuck in a retry loop and sends identical purchase intents 50 times a second. 
   - *The Defense:* Intercepted by Idempotency Locks. The system recognizes the Idempotency Key, halts execution, untouched funds, and gracefully returns the cached state of the first request.

---

## 🛠️ Tech Stack & Architecture

- **Backend Trust Layer**: Go (Gin, pgx, go-redis) - Chosen for strict typing, deterministic execution, and high-concurrency Goroutines.
- **Database**: PostgreSQL - Relational schema ensuring ACID compliance across Transactions, Audits, Policies, and Grants.
- **Caching & Rate-Limiting**: Redis - Fast in-memory datastore for rapid idempotency lock checking and global rate limiting.
- **Frontend Command Center**: Next.js 16 (Turbopack, TypeScript, Tailwind CSS, Framer Motion) - Delivering a beautiful, responsive, and highly interactive user experience.

---

## 💻 Local Setup & Deployment Guide

### Deploy to Render

This repository includes a Render Blueprint at `render.yaml`. It deploys a Go API, a public Next.js dashboard, and a managed PostgreSQL database. The API initializes the schema and demo data before it starts, so a new database needs no manual migration steps.

1. Push this repository to GitHub, then in Render select **New > Blueprint** and select the repository.
2. During Blueprint setup, enter test-mode `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` values for the API, and a `GROQ_API_KEY` for the dashboard. Never commit these values.
3. Create the Blueprint and wait for both web services to finish. Open the `aegiscommerce-dashboard` URL. The dashboard calls the API over Render's private network.

This is a demo environment: the attack lab and `simulate-capture` endpoint deliberately support test flows. Use Razorpay test keys only; do not expose this deployment to real payment traffic without adding user authentication, restricting CORS, and removing test-only endpoints.

This project is built to be run locally with minimal configuration overhead. Follow these steps to spin up the entire Agentic Commerce environment.

### 1. Prerequisites
Ensure you have the following installed on your machine:
- **Go** (1.21 or newer)
- **Node.js** (20 or newer) & **pnpm** (or npm/yarn)
- **Docker & Docker Compose** (for spinning up the required database and cache)

### 2. Spin up Infrastructure
We use Docker to instantly spin up the required PostgreSQL database and Redis cache. Run the provided compose file:
```bash
docker-compose up -d
```
*Note: Postgres is configured to run on port 5455 (to avoid conflicts with local DBs), and Redis on 6379.*

### 3. Initialize the Database
The backend requires the relational schema and initial seed data to exist.

**Step A: Apply the Schema Migration**
If you have the `migrate` CLI installed, run:
```bash
migrate -path migrations -database "postgres://commerce_user:commerce_password@127.0.0.1:5455/agentic_commerce?sslmode=disable" up
```
*(Alternatively, you can manually copy and run the SQL commands found inside `migrations/000001_init_schema.up.sql` via any SQL client).*

**Step B: Seed the Database**
Run the seeding script to populate the catalog, merchant profile, and initialize the demo agent's grant budget:
```bash
psql postgres://commerce_user:commerce_password@127.0.0.1:5455/agentic_commerce -f scripts/seeds.sql
```

### 4. Start the Trust Layer (Backend)
Navigate to the root directory of the project and start the Go server:
```bash
go run cmd/server/main.go
```
*The API will start successfully and bind to `http://localhost:8080`. You should see terminal logs indicating successful connections to Postgres and Redis.*

### 5. Start the Command Center (Frontend)
Open a new terminal window, navigate into the `frontend` directory, install the required node modules, and start the development server:
```bash
cd frontend
pnpm install
pnpm run dev
```
*The Dashboard will compile and become available at `http://localhost:3000`.*

---

## 🎮 Interacting with the Platform

Once both the backend and frontend are running, you can explore the full lifecycle of an Agentic Commerce transaction:

1. **Conversational Checkout**: Navigate to the chat panel. Ask the AI Agent for a product (e.g., *"I want to buy the AI Developer plan"*). Watch as it recommends the product, actively cross-sells you relevant items to grow the basket size, and ultimately asks for authorization to process the bundle.
2. **Authorize & Capture**: The frontend intercepts the agent's multi-item intent, securely contacts the Go Trust Layer, and creates an atomic proposed transaction. Once you confirm, it simulates a secure gateway checkout.
3. **Monitor the Lift**: Navigate to the Overview tab. Watch your live Revenue metrics and Policy Decisions update in real time. Notice how the dashboard isolates and displays the true revenue lift generated specifically by the AI's cross-selling.
4. **Execute the Attack Lab**: Head over to the Security tab and execute the Attack suite. Watch how the Trust Layer actively intercepts Rogue Agents and Replay attacks, updating the Threat counters and Audit Log immediately. 
5. **Manage Agent Grants**: Dynamically modify the maximum spending limit for the AI Agent on the fly. Watch how the deterministic policy engine instantly reacts, rejecting intents that exceed the newly defined budget limits to ensure absolute financial safety.

---
**AegisCommerce proves that autonomous agent-to-agent transactions can be scaled safely, bridging the Trust Gap and opening the door to the next era of global commerce.**
