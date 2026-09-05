import crypto from 'crypto';

const FULL_AGENT_ID = '22222222-2222-2222-2222-222222222222';
const MERCHANT_ID = '11111111-1111-1111-1111-111111111111';
const BACKEND_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8080/mcp/v1';

// This route handles DETERMINISTIC purchase execution.
// No LLM involved. The frontend sends the exact product data
// extracted from the previous search_catalog tool result.
export async function POST(req: Request) {
  try {
    const { product } = await req.json();

    if (!product || !product.id || !product.content_hash || !product.price_paise) {
      return Response.json({ error: 'Missing product data' }, { status: 400 });
    }

    const idempotency_key = crypto.randomUUID();

    console.log("[Purchase Route] Phase 1: Proposing transaction for product:", product.name, "₹" + product.price_paise / 100);

    // ── Phase 1: Propose (Trust Layer evaluates Grant, Policy, Integrity) ──
    const proposeRes = await fetch(`${BACKEND_URL}/checkout/propose`, {
      method: 'POST',
      headers: { 'X-Agent-ID': FULL_AGENT_ID, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        MerchantID: MERCHANT_ID,
        ProductID: product.id,
        Quantity: 1,
        ExpectedPrice: product.price_paise,
        Currency: "INR",
        CatalogHash: product.content_hash,
        IdempotencyKey: idempotency_key
      })
    });
    const proposeData = await proposeRes.json();

    if (!proposeRes.ok) {
      console.log("[Purchase Route] DENIED by Trust Layer:", proposeData.error);
      return Response.json({
        success: false,
        error: proposeData.error,
        message: `Transaction denied by Trust Layer: ${proposeData.error}`
      });
    }

    console.log("[Purchase Route] Phase 2: Executing payment via Razorpay for tx:", proposeData.data.id);

    // ── Phase 2: Execute Payment (Razorpay Order via Trust Layer) ──────────
    const executeRes = await fetch(`${BACKEND_URL}/checkout/execute`, {
      method: 'POST',
      headers: { 'X-Agent-ID': FULL_AGENT_ID, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_id: proposeData.data.id,
        idempotency_key: idempotency_key + "_pay"
      })
    });
    const executeData = await executeRes.json();

    console.log("[Purchase Route] Payment executed. Gateway order:", executeData.data?.gateway_order_id);

    return Response.json({
      success: true,
      transaction: proposeData.data,
      order: executeData.data,
      message: `Transaction authorized and payment pending for ${product.name} (₹${product.price_paise / 100})`
    });

  } catch (error: any) {
    console.error("[Purchase Route] Error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
