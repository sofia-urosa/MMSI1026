const state = { role: "attempters", week: "this_week", sortKey: "acceptance_pct", sortAsc: false, q: "", data: {} };

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
  const head = rows[0].map((h) => h.replace(/^﻿/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));

async function load(role) {
  try {
    const res = await fetch(`/api/data?role=${role}&t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    return parseCSV(await res.text());
  } catch (e) {
    return [];
  }
}

function view() {
  const w = state.week;
  return (state.data[state.role] || [])
    .map((r) => ({
      user_id: r.user_id,
      tasks: num(r[`tasks_${w}`]) || 0,
      acceptance_pct: num(r[`acceptance_pct_${w}`]),
      aht: num(r[`aht_${w}`])
    }))
    .filter((r) => r.user_id && r.tasks > 0);
}

const fmt = (v, d, s) => (v == null ? "–" : `${v.toFixed(d)}${s}`);

function render() {
  const q = state.q.toLowerCase();
  const k = state.sortKey;
  const list = view()
    .filter((r) => !q || r.user_id.toLowerCase().includes(q))
    .sort((a, b) => {
      if (k === "user_id") return state.sortAsc ? a.user_id.localeCompare(b.user_id) : b.user_id.localeCompare(a.user_id);
      const x = a[k] ?? -Infinity;
      const y = b[k] ?? -Infinity;
      return state.sortAsc ? x - y : y - x;
    });
  el("rows").innerHTML = list.map((r) => `
    <tr>
      <td class="uid">${r.user_id}</td>
      <td class="num">${fmt(r.acceptance_pct, 1, "%")}</td>
      <td class="num">${fmt(r.aht, 2, "h")}</td>
    </tr>`).join("");
  el("empty").hidden = list.length > 0;
  document.querySelectorAll("th[data-k]").forEach((th) => {
    th.classList.toggle("sorted", th.dataset.k === k);
    th.classList.toggle("asc", th.dataset.k === k && state.sortAsc);
  });
  const all = [...(state.data.attempters || []), ...(state.data.reviewers || [])];
  const ts = all.map((r) => r.generated_at_et).filter(Boolean).sort().pop();
  el("updated").textContent = ts ? `${ts} ET` : "";
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

(async () => {
  const [a, r] = await Promise.all([load("attempters"), load("reviewers")]);
  state.data = { attempters: a, reviewers: r };
  render();
})();
