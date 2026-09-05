const API_BASE_URL =
  (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8080/mcp/v1')
    .replace(/\/mcp\/v1$/, '');

export async function POST(req: Request) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/attacklab/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await req.json()),
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 502 });
  }
}
