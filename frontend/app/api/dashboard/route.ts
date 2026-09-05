const BACKEND_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8080/mcp/v1';
const API_BASE_URL = BACKEND_URL.replace(/\/mcp\/v1$/, '');

export async function GET(req: Request) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/dashboard`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });
    
    if (!res.ok) {
      return Response.json({ error: 'Failed to fetch from backend' }, { status: res.status });
    }
    
    const data = await res.json();
    return Response.json(data);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
