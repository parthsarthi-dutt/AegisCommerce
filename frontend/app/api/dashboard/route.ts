const BACKEND_URL = 'http://127.0.0.1:8080/api/dashboard';

export async function GET(req: Request) {
  try {
    const res = await fetch(BACKEND_URL, {
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
