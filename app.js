const RULES = {
  attempters: {
    aht: 3,
    tiers: [
      { tier: 1, pct: 50, min: 5, bonus: "+10%" },
      { tier: 2, pct: 65, min: 5, bonus: "+20%" },
      { tier: 3, pct: 80, min: 10, bonus: "+30%" }
    ],
    text: "<strong>Attempters.</strong> A task counts for the last attempter before the Difficulty Check. Accepted = passes the Difficulty Check on the first try and moves to GTFA. Sent back to queue = not accepted. System errors are excluded. AHT = attempter hours ÷ accepted tasks."
  },
  reviewers: {
    aht: 1,
    tiers: [
      { tier: 1, pct: 80, min: 5, bonus: "+10%" },
      { tier: 2, pct: 90, min: 5, bonus: "+20%" },
      { tier: 3, pct: 90, min: 10, bonus: "+30%" }
    ],
    text: "<strong>Reviewers.</strong> Counts every task worked in GTFA Independent Answer or GTFA Finalize Review. Accepted = the task reaches Crucible Intake and you were the last reviewer to touch it. AHT = reviewer hours ÷ accepted reviews."
  }
};

const state = { role: "attempters", week: "this_week", sortKey: "tier", sortAsc: false, q: "", data: {}, uploadedAt: null };

const el = (id) => document.getElementById(id);

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
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));

async function load(role) {
  try {
    const res = await fetch(`/api/data?role=${role}&t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return { rows: [], uploadedAt: null };
    return { rows: parseCSV(await res.text()), uploadedAt: res.headers.get("X-Uploaded-At") };
  } catch (e) {
    return { rows: [], uploadedAt: null };
  }
}

async function refresh() {
  const [a, r] = await Promise.all([load("attempters"), load("reviewers")]);
  state.data = { attempters: a.rows, reviewers: r.rows };
  state.uploadedAt = [a.uploadedAt, r.uploadedAt].filter(Boolean).sort().pop() || null;
  render();
}

function setStatus(text, kind) {
  const s = el("uploadStatus");
  s.textContent = text;
  s.className = `status ${kind || ""}`;
}

async function uploadOne(role, file, key) {
  const csv = await file.text();
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Upload-Key": key },
    body: JSON.stringify({ role, csv })
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${role}: ${out.error || res.status}`);
  return `${role}: ${out.rows} rows`;
}

async function handleUpload() {
  const key = el("uploadKey").value.trim();
  const jobs = [
    ["attempters", el("fileAttempters").files[0]],
    ["reviewers", el("fileReviewers").files[0]]
  ].filter(([, f]) => f);
  if (!key) return setStatus("Enter the upload key", "err");
  if (!jobs.length) return setStatus("Choose at least one CSV", "err");
  try { sessionStorage.setItem("mmsi_key", key); } catch (e) {}
  el("uploadBtn").disabled = true;
  setStatus("Uploading…");
  try {
    const done = [];
    for (const [role, file] of jobs) done.push(await uploadOne(role, file, key));
    setStatus(`Uploaded ${done.join(" · ")}`, "ok");
    el("fileAttempters").value = "";
    el("fileReviewers").value = "";
    await refresh();
  } catch (e) {
    setStatus(e.message, "err");
  } finally {
    el("uploadBtn").disabled = false;
  }
}

function view() {
  const rows = state.data[state.role] || [];
  const w = state.week;
  return rows.map((r) => ({
    user_id: r.user_id,
    tasks: num(r[`tasks_${w}`]) || 0,
    accepted: num(r[`accepted_${w}`]) || 0,
    pending: num(r[`pending_${w}`]) || 0,
    acceptance_pct: num(r[`acceptance_pct_${w}`]),
    hours: num(r[`hours_${w}`]),
    aht: num(r[`aht_${w}`]),
    tier: num(r[`tier_${w}`]) || 0,
    generated: r.generated_at_et
  })).filter((r) => r.tasks > 0);
}

function nextStep(r, rules) {
  if (r.tier === 3) return "Top tier reached";
  const target = rules.tiers.find((t) => t.tier === r.tier + 1);
  const needs = [];
  if (r.accepted < target.min) needs.push(`+${target.min - r.accepted} accepted`);
  if (r.acceptance_pct == null || r.acceptance_pct < target.pct) needs.push(`acceptance ≥${target.pct}%`);
  if (r.aht == null || r.aht > rules.aht) needs.push(`AHT ≤${rules.aht}h`);
  return needs.length ? `Tier ${target.tier}: ${needs.join(", ")}` : `Tier ${target.tier} pending review`;
}

const fmt = (v, d = 1, s = "") => (v == null ? "–" : `${v.toFixed(d)}${s}`);

function renderCards(list) {
  const total = list.reduce((a, r) => a + r.tasks, 0);
  const acc = list.reduce((a, r) => a + r.accepted, 0);
  const pend = list.reduce((a, r) => a + r.pending, 0);
  const rate = total - pend > 0 ? (100 * acc) / (total - pend) : null;
  const byTier = [1, 2, 3].map((t) => list.filter((r) => r.tier === t).length);
  const cards = [
    ["CBs active", list.length],
    ["Tasks", total],
    ["Accepted", acc],
    ["Acceptance", fmt(rate, 1, "%")],
    ["Tier 1", byTier[0]],
    ["Tier 2", byTier[1]],
    ["Tier 3", byTier[2]]
  ];
  el("cards").innerHTML = cards.map(([l, v]) => `<div class="card"><div class="label">${l}</div><div class="value">${v}</div></div>`).join("");
}

function renderRules() {
  const r = RULES[state.role];
  const tiers = r.tiers.map((t) => `<li>Tier ${t.tier}: ${t.pct}%+ acceptance, min. ${t.min} accepted, AHT ≤${r.aht}h → ${t.bonus}</li>`).join("");
  el("rules").innerHTML = `${r.text}<ul>${tiers}</ul>`;
}

function renderTable(list) {
  const rules = RULES[state.role];
  const q = state.q.toLowerCase();
  const k = state.sortKey;
  const sorted = list
    .filter((r) => !q || r.user_id.toLowerCase().includes(q))
    .sort((a, b) => {
      const x = a[k] ?? -1;
      const y = b[k] ?? -1;
      const c = typeof x === "string" ? x.localeCompare(y) : x - y;
      return state.sortAsc ? c : -c || b.accepted - a.accepted;
    });
  el("rows").innerHTML = sorted.map((r) => `
    <tr>
      <td class="uid">${r.user_id}</td>
      <td class="num">${r.tasks}</td>
      <td class="num">${r.accepted}</td>
      <td class="num">${r.pending}</td>
      <td class="num">${fmt(r.acceptance_pct, 1, "%")}</td>
      <td class="num">${fmt(r.hours, 1, "h")}</td>
      <td class="num ${r.aht != null && r.aht > rules.aht ? "bad" : ""}">${fmt(r.aht, 2, "h")}</td>
      <td class="num"><span class="tier t${r.tier}">${r.tier ? "T" + r.tier : "–"}</span></td>
      <td class="next">${nextStep(r, rules)}</td>
    </tr>`).join("");
  el("empty").hidden = sorted.length > 0;
  document.querySelectorAll("th[data-k]").forEach((th) => {
    th.classList.toggle("sorted", th.dataset.k === k);
    th.classList.toggle("asc", th.dataset.k === k && state.sortAsc);
  });
}

function renderUpdated() {
  const all = [...(state.data.attempters || []), ...(state.data.reviewers || [])];
  const ts = all.map((r) => r.generated_at_et).filter(Boolean).sort().pop();
  if (ts) el("updated").textContent = `Data as of ${ts} ET`;
  else if (state.uploadedAt) el("updated").textContent = `Uploaded ${new Date(state.uploadedAt).toLocaleString()}`;
  else el("updated").textContent = "No data uploaded yet";
}

function render() {
  const list = view();
  renderCards(list);
  renderRules();
  renderTable(list);
  renderUpdated();
}

function bindSeg(id, attr, key) {
  el(id).addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    state[key] = b.dataset[attr];
    el(id).querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    render();
  });
}

bindSeg("roleSeg", "role", "role");
bindSeg("weekSeg", "week", "week");
el("search").addEventListener("input", (e) => { state.q = e.target.value; render(); });
document.querySelectorAll("th[data-k]").forEach((th) => th.addEventListener("click", () => {
  if (state.sortKey === th.dataset.k) state.sortAsc = !state.sortAsc;
  else { state.sortKey = th.dataset.k; state.sortAsc = th.dataset.k === "user_id"; }
  render();
}));

el("uploadToggle").addEventListener("click", () => {
  const p = el("uploadPanel");
  p.hidden = !p.hidden;
  if (!p.hidden) {
    try { el("uploadKey").value = sessionStorage.getItem("mmsi_key") || ""; } catch (e) {}
  }
});
el("uploadBtn").addEventListener("click", handleUpload);

refresh();
