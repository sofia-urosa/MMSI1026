import { validKey } from "./_store.js";

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Upload</title>
<link rel="stylesheet" href="/styles.css">
<style>
.box { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px; margin-top: 20px; display: grid; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 12px; color: var(--muted); }
.field input { font: inherit; color: var(--muted); max-width: 100%; }
.row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
button { border: 0; border-radius: 8px; padding: 8px 16px; background: var(--accent); color: #fff; font: inherit; cursor: pointer; }
button:disabled { opacity: 0.6; cursor: default; }
.status { font-size: 13px; color: var(--muted); }
.ok { color: #17734a; }
.err { color: #c23b22; }
</style>
</head>
<body>
<header><div class="wrap head"><h1>Upload</h1><a class="updated" href="/">View app</a></div></header>
<main class="wrap">
  <div class="box">
    <div class="field"><label for="fa">attempters.csv</label><input id="fa" type="file" accept=".csv,text/csv"></div>
    <div class="field"><label for="fr">reviewers.csv</label><input id="fr" type="file" accept=".csv,text/csv"></div>
    <div class="row"><button id="go">Upload</button><span class="status" id="st"></span></div>
  </div>
</main>
<script>
const key = decodeURIComponent(location.pathname.replace(/^\\/+|\\/+$/g, ""));
const st = document.getElementById("st");
const say = (t, c) => { st.textContent = t; st.className = "status " + (c || ""); };
async function send(role, file) {
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Upload-Key": key },
    body: JSON.stringify({ role, csv: await file.text() })
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(role + ": " + (out.error || res.status));
  return role + ": " + out.rows + " rows";
}
document.getElementById("go").addEventListener("click", async () => {
  const jobs = [["attempters", document.getElementById("fa").files[0]], ["reviewers", document.getElementById("fr").files[0]]].filter((j) => j[1]);
  if (!jobs.length) return say("Choose at least one CSV", "err");
  const btn = document.getElementById("go");
  btn.disabled = true;
  say("Uploading…");
  try {
    const done = [];
    for (const [role, file] of jobs) done.push(await send(role, file));
    say("Uploaded " + done.join(" · "), "ok");
    document.getElementById("fa").value = "";
    document.getElementById("fr").value = "";
  } catch (e) {
    say(e.message, "err");
  } finally {
    btn.disabled = false;
  }
});
</script>
</body>
</html>`;

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (!validKey(String(req.query?.slug || ""))) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(404).send("Not found");
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(page);
}
