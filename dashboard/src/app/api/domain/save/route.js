import fs from 'fs';
import path from 'path';

export async function POST(req) {
  try {
    const body = await req.json();
    const base = path.resolve(process.cwd());
    const cacheDir = path.join(base);
    try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (e) { }
    const file = path.join(cacheDir, 'schema-state.json');
    fs.writeFileSync(file, JSON.stringify(body, null, 2), 'utf8');
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
