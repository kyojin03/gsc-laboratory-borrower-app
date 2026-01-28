let allRows = [];
let filteredRows = [];
let headers = [];

const el = (id) => document.getElementById(id);

function parseCSV(text) {
  // Basic CSV parser (handles quoted commas)
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"' && next === '"') { cur += '"'; i++; continue; }
    if (c === '"') { inQuotes = !inQuotes; continue; }

    if (!inQuotes && (c === ",")) { row.push(cur); cur = ""; continue; }
    if (!inQuotes && (c === "\n" || c === "\r")) {
      if (c === "\r" && next === "\n") i++;
      row.push(cur); rows.push(row);
      row = []; cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }

  // Remove empty last line
  return rows.filter(r => r.some(cell => String(cell).trim() !== ""));
}

function rowsToObjects(parsed) {
  headers = parsed[0].map(h => h.trim());
  return parsed.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, idx) => obj[h] = (r[idx] ?? "").trim());
    return obj;
  });
}

function toISODateMaybe(ts) {
  // Google Forms Timestamp looks like "1/28/2026 10:42:15" depending locale.
  // We'll rely on Date() parsing; if fails, return null.
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return d;
}

function applyFilters() {
  const dept = el("dept").value.trim().toLowerCase();
  const fac = el("faculty").value.trim().toLowerCase();
  const from = el("fromDate").value ? new Date(el("fromDate").value) : null;
  const to = el("toDate").value ? new Date(el("toDate").value) : null;

  filteredRows = allRows.filter(r => {
    const rDept = (r.Department || r.department || "").trim().toLowerCase();
    const rFac = (r.FacultyName || r["FACULTY NAME"] || r.faculty || "").trim().toLowerCase();

    if (dept && rDept !== dept) return false;
    if (fac && !rFac.includes(fac)) return false;

    const d = toISODateMaybe(r.Timestamp || r.timestamp || "");
    if (from && d && d < from) return false;
    if (to && d && d > new Date(to.getTime() + 24*60*60*1000 - 1)) return false;

    return true;
  });

  render();
}

function render() {
  // Table
  const thead = el("table").querySelector("thead");
  const tbody = el("table").querySelector("tbody");
  thead.innerHTML = "";
  tbody.innerHTML = "";

  const showHeaders = headers.length ? headers : Object.keys(filteredRows[0] || {});
  const trh = document.createElement("tr");
  showHeaders.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    trh.appendChild(th);
  });
  thead.appendChild(trh);

  filteredRows.forEach(r => {
    const tr = document.createElement("tr");
    showHeaders.forEach(h => {
      const td = document.createElement("td");
      td.textContent = r[h] ?? "";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  // Summary
  const total = filteredRows.length;
  const incidents = filteredRows.filter(r => String(r.Incident || r["Incident?"] || "").toLowerCase().includes("yes")).length;

  const groupsSum = filteredRows.reduce((acc, r) => {
    const v = Number(r.GroupsRequested || r["Number of Groups Requested"] || "");
    return acc + (isFinite(v) ? v : 0);
  }, 0);

  el("summary").textContent =
    `Records: ${total} | Incidents: ${incidents} | Total Groups Requested (sum): ${groupsSum}`;
}

function exportFilteredCSV() {
  const rows = [headers];
  filteredRows.forEach(obj => rows.push(headers.map(h => obj[h] ?? "")));

  const csv = rows.map(r => r.map(cell => {
    const s = String(cell ?? "");
    if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replaceAll('"','""')}"`;
    return s;
  }).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gsc_borrower_filtered.csv";
  a.click();
  URL.revokeObjectURL(url);
}

async function loadCSV() {
  const url = el("csvUrl").value.trim();
  if (!url) { alert("Paste your CSV link first."); return; }

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) { alert("Failed to load CSV. Check link access."); return; }
  const text = await res.text();

  const parsed = parseCSV(text);
  allRows = rowsToObjects(parsed);
  filteredRows = [...allRows];

  render();
}

el("loadBtn").addEventListener("click", loadCSV);
el("applyBtn").addEventListener("click", applyFilters);
el("exportBtn").addEventListener("click", exportFilteredCSV);
