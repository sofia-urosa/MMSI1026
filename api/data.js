import { get } from "@vercel/blob";
import { ACCESS, ROLES, blobPath } from "./_store.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const role = req.query?.role;
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: "role must be attempters or reviewers" });
  }

  res.setHeader("Cache-Control", "no-store");

  let result;
  try {
    result = await get(blobPath(role), { access: ACCESS, useCache: false });
  } catch (e) {
    if (e?.name === "BlobNotFoundError" || /not found/i.test(e?.message || "")) {
      return res.status(404).json({ error: "No data uploaded yet" });
    }
    return res.status(500).json({ error: `Read failed: ${e.message}` });
  }

  if (!result || result.statusCode !== 200) {
    return res.status(404).json({ error: "No data uploaded yet" });
  }

  const text = await new Response(result.stream).text();
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  const at = new Date(result.blob?.uploadedAt);
  if (!isNaN(at)) res.setHeader("X-Uploaded-At", at.toISOString());
  return res.status(200).send(text);
}
