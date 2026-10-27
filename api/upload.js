import { put } from "@vercel/blob";
import { ACCESS, REQUIRED_COLUMNS, ROLES, blobPath, headerColumns, stripPrivate, validKey, validPassword } from "./_store.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!validKey(req.headers["x-upload-key"]) || !validPassword(req.headers["x-upload-password"])) {
    await wait(1500);
    return res.status(401).json({ error: "Wrong password" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  const role = body?.role;
  const csv = body?.csv;

  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: "role must be attempters or reviewers" });
  }

  if (typeof csv !== "string" || !csv.trim()) {
    return res.status(400).json({ error: "CSV is empty" });
  }

  const columns = headerColumns(csv);
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length) {
    return res.status(400).json({ error: `Missing columns: ${missing.join(", ")}` });
  }

  const uploadedAt = new Date().toISOString();
  const clean = stripPrivate(csv, uploadedAt);
  const rows = clean.rows;

  try {
    await put(blobPath(role), clean.csv, {
      access: ACCESS,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/csv; charset=utf-8",
      cacheControlMaxAge: 60
    });
  } catch (e) {
    return res.status(500).json({ error: `Upload failed: ${e.message}` });
  }

  return res.status(200).json({ ok: true, role, rows, uploadedAt });
}
