import { timingSafeEqual } from "node:crypto";

export const ROLES = ["attempters", "reviewers"];

export const ACCESS = process.env.BLOB_ACCESS === "private" ? "private" : "public";

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

export function headerColumns(csv) {
  const first = csv.replace(/^﻿/, "").split(/\r?\n/)[0] || "";
  return first
    .split(",")
    .map((h) => h.replace(/"/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
}
