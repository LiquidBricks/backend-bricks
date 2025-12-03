import fs from "fs";
import path from "path";

const STATE_FILE = "schema-canvas-state.json";
const DEFAULT_STATE_FILE = "schema-canvas-state.default.json";

export async function GET() {
  try {
    const base = path.resolve(process.cwd());
    const file = path.join(base, STATE_FILE);
    const defaultFile = path.join(base, DEFAULT_STATE_FILE);

    let data;
    if (fs.existsSync(file)) {
      const contents = fs.readFileSync(file, "utf8");
      data = JSON.parse(contents || "{}");
    } else if (fs.existsSync(defaultFile)) {
      const contents = fs.readFileSync(defaultFile, "utf8");
      data = JSON.parse(contents || "{}");
    } else {
      data = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
