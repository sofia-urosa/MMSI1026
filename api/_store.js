import { timingSafeEqual } from "node:crypto";

export const ROLES = ["attempters", "reviewers"];

export const ACCESS = (process.env.BLOB_ACCESS || "private").trim().toLowerCase() === "public" ? "public" : "private";

export const REQUIRED_COLUMNS = [
  "user_id",
  "tasks_this_week",
  "accepted_this_week",
  "acceptance_pct_this_week",
  "aht_this_week",
  "tier_this_week",
  "tasks_next_week",
  "accepted_next_week",
  "tier_next_week"
];

export const blobPath = (role) => `mmscience-incentive-1026/${role}.csv`;

function safeEqual(provided, expected) {
  if (!expected || typeof provided !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const validKey = (provided) => safeEqual(provided, process.env.UPLOAD_PATH || "");

export const validPassword = (provided) => safeEqual(provided, process.env.UPLOAD_PASSWORD || "");

export const PRIVATE_COLUMNS = ["email", "first_name", "eligible_accepted_this_week", "eligible_hours_this_week", "eligible_accepted_next_week", "eligible_hours_next_week"];

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}

const quote = (v) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

const norm = (h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export function stripPrivate(csv, uploadedAt) {
  const rows = parseCSV(csv.replace(/^﻿/, ""));
  if (!rows.length) return { csv: "", rows: 0 };
  const drop = [...PRIVATE_COLUMNS, "uploaded_at"];
  const keep = rows[0].map((h, i) => (drop.includes(norm(h)) ? -1 : i)).filter((i) => i >= 0);
  const out = rows
    .map((r, n) => [...keep.map((i) => quote(r[i] ?? "")), n === 0 ? "uploaded_at" : uploadedAt].join(","))
    .join("\n") + "\n";
  return { csv: out, rows: rows.length - 1 };
}

export function headerColumns(csv) {
  const first = csv.replace(/^﻿/, "").split(/\r?\n/)[0] || "";
  return first
    .split(",")
    .map((h) => h.replace(/"/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
}
