// Cloudflare Pages Function — /api/data
// Stores the entire Money Manager dataset (entries, mileage, settings,
// imported_receipts, merchant_rules) as one JSON blob in a single D1 row.
// Requires a D1 database bound to this Pages project as "DB".
//
// Access control: every request must carry the app password in the
// "x-app-password" header, matching the APP_PASSWORD env var set on the
// Pages project. Fails closed — no password configured means locked.

const ROW_ID = 1;

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function checkAuth(request, env) {
  const expected = env.APP_PASSWORD;
  if (!expected) return false;
  const got = request.headers.get("x-app-password") || "";
  return timingSafeEqual(got, expected);
}

async function ensureTable(db) {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS money_data (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)"
  );
}

export async function onRequestGet({ request, env }) {
  if (!checkAuth(request, env)) return unauthorized();
  try {
    await ensureTable(env.DB);
    const row = await env.DB
      .prepare("SELECT payload FROM money_data WHERE id = ?")
      .bind(ROW_ID)
      .first();

    const empty = {
      entries: [],
      imported_receipts: [],
      mileage: [],
      settings: [],
      merchant_rules: []
    };

    const data = row ? JSON.parse(row.payload) : empty;
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function onRequestPost({ request, env }) {
  if (!checkAuth(request, env)) return unauthorized();
  try {
    await ensureTable(env.DB);
    const body = await request.json();
    const payload = JSON.stringify({
      entries: body.entries || [],
      imported_receipts: body.imported_receipts || [],
      mileage: body.mileage || [],
      settings: body.settings || [],
      merchant_rules: body.merchant_rules || []
    });

    await env.DB
      .prepare(
        "INSERT INTO money_data (id, payload) VALUES (?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET payload = excluded.payload"
      )
      .bind(ROW_ID, payload)
      .run();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
