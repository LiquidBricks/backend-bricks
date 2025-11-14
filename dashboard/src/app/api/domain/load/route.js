import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const base = path.resolve(process.cwd());
    const file = path.join(base, 'schema-state.json');
    const defaultFile = path.join(base, 'schema-state.default.json');

    let data;
    if (fs.existsSync(file)) {
      const contents = fs.readFileSync(file, 'utf8');
      data = JSON.parse(contents || '{}');
    } else if (fs.existsSync(defaultFile)) {
      const contents = fs.readFileSync(defaultFile, 'utf8');
      data = JSON.parse(contents || '{}');
    } else {
      data = { nodes: [], edges: [] };
    }
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
