import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const base = path.resolve(process.cwd());
    const file = path.join(base, 'schema-state.json');
    if (!fs.existsSync(file)) {
      return new Response(JSON.stringify({ nodes: [], edges: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const contents = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(contents || '{}');
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
