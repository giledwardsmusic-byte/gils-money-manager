// Cloudflare Pages Function — /api/data
// Stores the entire Money Manager dataset (entries, mileage, settings,
// imported_receipts, merchant_rules) as one JSON blob in a single D1 row.
// Requires a D1 database bound to this Pages project as "DB".

const ROW_ID = 1;

async function ensureTable(db) {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS money_data (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)"
  );
}

export async function onRequestGet({ env }) {
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

export async function onRequestPost({ env, request }) {
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
