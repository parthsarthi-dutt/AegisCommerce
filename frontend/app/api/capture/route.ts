import crypto from 'crypto';

const FULL_AGENT_ID = '22222222-2222-2222-2222-222222222222';
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8080/mcp/v1';

export async function POST(req: Request) {
  try {
    const { transaction_id, payment_id } = await req.json();

    if (!transaction_id) {
      return Response.json({ error: 'Missing transaction_id' }, { status: 400 });
    }

    console.log(`[Capture Route] Finalizing capture for transaction: ${transaction_id} with payment: ${payment_id}`);

    // In a real production environment, you would verify the Razorpay signature here
    // using razorpay_order_id, razorpay_payment_id, and razorpay_signature.
    // For this demo, we instruct the Trust Layer to finalize the capture and update audit logs.
    const captureRes = await fetch(`${BACKEND_URL}/checkout/simulate-capture`, {
      method: 'POST',
      headers: { 'X-Agent-ID': FULL_AGENT_ID, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_id: transaction_id
      })
    });
    
    if (!captureRes.ok) {
        const errorData = await captureRes.json();
        return Response.json({ success: false, error: errorData.error }, { status: 500 });
    }

    const captureData = await captureRes.json();

    return Response.json({
      success: true,
      message: `Transaction successfully captured and audit trails updated.`
    });

  } catch (error: any) {
    console.error("[Capture Route] Error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
