import fs from "fs";
import path from "path";

const STATE_FILE = "schema-canvas-state.json";

export async function POST(req) {
  try {
    const body = await req.json();
    const base = path.resolve(process.cwd());
    const cacheDir = path.join(base);
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
    } catch {
      // no-op if the directory already exists
    }
    const file = path.join(cacheDir, STATE_FILE);
    fs.writeFileSync(file, JSON.stringify(body, null, 2), "utf8");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
