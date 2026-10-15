"use strict";
/* EMS 品管儀表板（樣板）— 資料來自 data/dashboard.json（export_data.py 產生，只有彙總，沒有病人資料） */

const BUILD = "2026.10.15.1";

const PAGES = [
  { id: "overview", name: "總覽", ic: "📊" },
  { id: "time", name: "時效", ic: "⏱️" },
  { id: "clinical", name: "臨床", ic: "🩺" },
  { id: "unit", name: "分隊", ic: "🚑" },
  { id: "quality", name: "品管", ic: "📈" },
  { id: "more", name: "更多", ic: "⚙️" },
];
const RANGES = [["7", "近 7 天"], ["30", "近 30 天"], ["90", "近 90 天"], ["all", "全部"], ["custom", "自訂"]];
const C = {
  text: "#b4bfd6", muted: "#7f8cab", grid: "#1c2741", line: "#23304d", panel: "#111a2e",
  s: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
  good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b",
  seq: ["#16213a", "#184f95", "#2a78d6", "#6da7ec", "#cde2fb"],
};
const FONT = '"Microsoft JhengHei","PingFang TC","Noto Sans TC",system-ui,sans-serif';

/* ───────────── 儲存（localStorage 可能被清或被擋 → 一律 try，並有記憶體備援） ───────────── */
const MEM = {};
function lsGet(k, d) {
  try { const v = localStorage.getItem(k); if (v != null) return JSON.parse(v); } catch (e) { /* 私密瀏覽 */ }
  return k in MEM ? MEM[k] : d;
}
function lsSet(k, v) { MEM[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 忽略 */ } }

/* ───────────── 狀態（網址 hash 優先，讓主畫面捷徑能帶回設定） ───────────── */
const S = {
  page: "overview", region: "all", range: "30", from: "", to: "", gran: "week", unit: "", view: "auto",
  thr: 8, funnelInd: "tri_unrated", pInd: "dq_rr18", dqInd: "dq_rr18",
  logOn: true, logClear: true,
};
function loadState() {
  Object.assign(S, lsGet("ems_prefs", {}));
  const h = location.hash.replace(/^#/, "").replace(/\s+/g, "");
  for (const part of h.split("&")) {
    const [k, v] = part.split("=");
    if (!k || v == null) continue;
    const val = decodeURIComponent(v);
    if (k === "p") S.page = val; else if (k === "r") S.region = val; else if (k === "rg") S.range = val;
    else if (k === "u") S.unit = val; else if (k === "v") S.view = val; else if (k === "g") S.gran = val;
    else if (k === "f") S.from = val; else if (k === "t") S.to = val;
  }
  if (!PAGES.some(p => p.id === S.page)) S.page = "overview";
}
function saveState() {
  const keep = { region: S.region, range: S.range, gran: S.gran, unit: S.unit, view: S.view, thr: S.thr,
    funnelInd: S.funnelInd, pInd: S.pInd, dqInd: S.dqInd, logOn: S.logOn, logClear: S.logClear, from: S.from, to: S.to };
  lsSet("ems_prefs", keep);
  const parts = [["p", S.page], ["r", S.region], ["rg", S.range], ["g", S.gran], ["v", S.view]];
  if (S.unit) parts.push(["u", S.unit]);
  if (S.range === "custom") parts.push(["f", S.from], ["t", S.to]);
  const h = "#" + parts.map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
  try { history.replaceState(null, "", h); } catch (e) { /* file:// 某些情況不允許 */ }
}

/* ───────────── 偵錯 log（存在 localStorage 的 debug_log；設定頁可看可複製） ───────────── */
function log(msg) {
  if (!S.logOn) return;
  const t = new Date();
  const p = n => String(n).padStart(2, "0");
  const line = `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())} ${msg}`;
  const arr = lsGet("debug_log", []);
  arr.push(line);
  lsSet("debug_log", arr.slice(-800));
}
window.addEventListener("error", e => log(`[錯誤] ${e.message} @${(e.filename || "").split("/").pop()}:${e.lineno}`));
window.addEventListener("unhandledrejection", e => log(`[錯誤] ${e.reason && e.reason.message || e.reason}`));

/* ───────────── 工具 ───────────── */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtPct = (p, d = 1) => p == null || isNaN(p) ? "—" : (p * 100).toFixed(d) + "%";
const fmtMin = x => x == null || isNaN(x) ? "—" : x.toFixed(1);
const fmtInt = x => x == null ? "—" : x.toLocaleString("en-US");
function quant(arr, q) {
  if (!arr || !arr.length) return null;
  const pos = (arr.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return arr[lo] + (arr[hi] - arr[lo]) * (pos - lo);
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return localIso(d);
}
function localIso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function dayDiff(a, b) { return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000); }
function weekStart(iso) { const d = new Date(iso + "T00:00:00"); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return localIso(d); }
function dowOf(iso) { return (new Date(iso + "T00:00:00").getDay() + 6) % 7; }
const DOW = ["一", "二", "三", "四", "五", "六", "日"];

/* ───────────── 資料 ───────────── */
let D = null;
const MEMO = new Map();
function bounds() {
  const max = D.maxDate, min = D.minDate;
  if (S.range === "custom" && S.from && S.to) return { from: S.from <= S.to ? S.from : S.to, to: S.from <= S.to ? S.to : S.from };
  if (S.range === "all") return { from: min, to: max };
  const n = parseInt(S.range, 10) || 30;
  return { from: addDays(max, -(n - 1)), to: max };
}
function prevBounds(b) {
  const len = dayDiff(b.from, b.to) + 1;
  return { from: addDays(b.from, -len), to: addDays(b.from, -1) };
}
function cellsOf({ region = S.region, unit = "", from, to } = {}) {
  const b = from ? { from, to } : bounds();
  return D.cells.filter(c => c.d >= b.from && c.d <= b.to && (region === "all" || c.r === region) && (!unit || c.u === unit));
}
function agg(cells) {
  const a = { n: 0, c: {}, v: {}, h: new Array(24).fill(0), hw: new Array(168).fill(0), days: new Set() };
  for (const c of cells) {
    a.n += c.n;
    a.days.add(c.d);
    for (const k in c.c) a.c[k] = (a.c[k] || 0) + c.c[k];
    for (const k in c.v) { (a.v[k] || (a.v[k] = [])).push(...c.v[k]); }
    const dw = dowOf(c.d);
    for (let h = 0; h < 24; h++) { a.h[h] += c.h[h]; a.hw[dw * 24 + h] += c.h[h]; }
  }
  for (const k in a.v) a.v[k].sort((x, y) => x - y);
  return a;
}
function aggOf(opts = {}) {
  const b = opts.from ? { from: opts.from, to: opts.to } : bounds();
  const key = [opts.region ?? S.region, opts.unit || "", b.from, b.to].join("|");
  if (!MEMO.has(key)) MEMO.set(key, agg(cellsOf({ ...opts, from: b.from, to: b.to })));
  return MEMO.get(key);
}
function rate(a, ind) {
  const num = a.c[ind.num] || 0;
  const den = ind.den === "n" ? a.n : (a.c[ind.den] || 0);
  return { num, den, p: den ? num / den : null };
}
function catCounts(a, prefix) {
  const out = [];
  for (const k in a.c) if (k.startsWith(prefix + ":")) out.push([k.slice(prefix.length + 1), a.c[k]]);
  return out.sort((x, y) => y[1] - x[1]);
}
/* 期間序列：每個期間一個 agg */
function periods(opts = {}) {
  const b = bounds();
  const keys = [];
  const seen = new Set();
  for (let d = b.from; d <= b.to; d = addDays(d, 1)) {
    const k = S.gran === "day" ? d : weekStart(d);
    if (!seen.has(k)) { seen.add(k); keys.push(k); }
  }
  const groups = new Map(keys.map(k => [k, []]));
  for (const c of cellsOf(opts)) {
    const k = S.gran === "day" ? c.d : weekStart(c.d);
    if (groups.has(k)) groups.get(k).push(c);
  }
  const span = new Map(keys.map(k => [k, 0]));
  for (let d = b.from; d <= b.to; d = addDays(d, 1)) { const k = S.gran === "day" ? d : weekStart(d); span.set(k, span.get(k) + 1); }
  return keys.map(k => ({ k, span: span.get(k), label: S.gran === "day" ? k.slice(5).replace("-", "/") : k.slice(5).replace("-", "/") + "週" + (span.get(k) < 7 ? "*" : ""), a: agg(groups.get(k)) }));
}
function unitsOf(region) {
  if (region === "all") return [...(D.regions["嘉義市"] || []).map(u => ["嘉義市", u]), ...(D.regions["嘉義縣"] || []).map(u => ["嘉義縣", u])];
  return (D.regions[region] || []).map(u => [region, u]);
}
function regionOfUnit(u) {
  for (const r in D.regions) if (D.regions[r].includes(u)) return r;
  return "all";
}
const IND = Object.fromEntries(RATE_IND.map(i => [i.id, i]));
const TIND = Object.fromEntries(TIME_IND.map(i => [i.id, i]));

/* funnel 判定：跟全區比 */
function funnelStatus(num, den, p0, ind) {
  if (!den || den < (ind.minDen || 1) || p0 == null || p0 <= 0 || p0 >= 1) return { cls: "st-na", ic: "·", t: "樣本少" };
  const p = num / den;
  const z = (p - p0) / Math.sqrt(p0 * (1 - p0) / den);
  if (Math.abs(z) <= 1.96 || !ind.better) return { cls: "st-na", ic: "◯", t: Math.abs(z) > 1.96 ? (z > 0 ? "偏高" : "偏低") : "範圍內", z };
  const good = (z > 0) === (ind.better === "high");
  if (good) return { cls: "st-good", ic: "▲", t: "優於預期", z };
  return Math.abs(z) > 3.09 ? { cls: "st-bad", ic: "▼▼", t: "顯著落後", z } : { cls: "st-warn", ic: "▼", t: "需注意", z };
}

/* ───────────── 圖表共用 ───────────── */
let CHARTS = [];
let MAPS = [];
function disposeAll() {
  CHARTS.forEach(c => { try { c.dispose(); } catch (e) { /* */ } });
  CHARTS = [];
  MAPS.forEach(m => { try { m.remove(); } catch (e) { /* */ } });
  MAPS = [];
}
function mk(id, opt) {
  const el = document.getElementById(id);
  if (!el || !window.echarts) return null;
  const ch = echarts.init(el, null, { renderer: "canvas" });
  ch.setOption(Object.assign({
    backgroundColor: "transparent", animationDuration: 300,
    textStyle: { fontFamily: FONT, color: C.text },
  }, opt));
  CHARTS.push(ch);
  return ch;
}
const AX = (extra = {}) => Object.assign({
  axisLine: { lineStyle: { color: C.line } }, axisTick: { show: false },
  axisLabel: { color: C.muted, fontSize: 11, fontFamily: FONT }, splitLine: { lineStyle: { color: C.grid } },
  nameTextStyle: { color: C.muted, fontSize: 11 },
}, extra);
const TT = (extra = {}) => Object.assign({
  backgroundColor: "#0d1526", borderColor: C.line, textStyle: { color: "#e6ebf5", fontSize: 12, fontFamily: FONT },
  confine: true,
}, extra);
const GRID = (extra = {}) => Object.assign({ left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, extra);
const LEG = (extra = {}) => Object.assign({ top: 0, left: 0, icon: "roundRect", itemWidth: 12, itemHeight: 4,
  textStyle: { color: C.text, fontSize: 12 } }, extra);

/* 折線（趨勢）。series: [{name, data:[{value,num,den}|number|null], color, dashed, area}] */
function lineChart(id, labels, series, o = {}) {
  const fmtV = o.pct ? (v => fmtPct(v)) : (o.min ? (v => fmtMin(v) + " 分") : (v => fmtInt(v)));
  return mk(id, {
    grid: GRID({ top: series.length > 1 ? 30 : 16 }),
    legend: series.length > 1 ? LEG({ data: series.filter(s => !s.noLegend).map(s => s.name) }) : undefined,
    tooltip: TT({
      trigger: "axis", axisPointer: { type: "line", lineStyle: { color: C.muted, type: "dashed" } },
      formatter: ps => {
        let s = `<b>${esc(ps[0].axisValueLabel)}</b>`;
        for (const p of ps) {
          if (p.seriesName.startsWith("_")) continue;
          const d = p.data, v = d && typeof d === "object" ? d.value : d;
          const extra = d && typeof d === "object" && d.den != null ? ` <span style="color:${C.muted}">(${d.num}/${d.den})</span>` : (d && d.n != null ? ` <span style="color:${C.muted}">${o.min ? "n=" : "共 "}${d.n}${o.min ? "" : " 件"}</span>` : "");
          s += `<br>${p.marker}${esc(p.seriesName)}　${v == null ? "—" : fmtV(v)}${extra}`;
        }
        return s;
      },
    }),
    xAxis: AX({ type: "category", data: labels, boundaryGap: false, splitLine: { show: false } }),
    yAxis: AX({ type: "value", min: o.yMin, max: o.yMax, name: o.yName, axisLabel: { color: C.muted, fontSize: 11, formatter: o.pct ? (v => Math.round(v * 100) + "%") : undefined } }),
    series: series.map((s, i) => ({
      name: s.name, type: "line", data: s.data, connectNulls: false, smooth: false, showSymbol: labels.length <= 31,
      symbolSize: 6, lineStyle: { width: 2, type: s.dashed ? "dashed" : "solid", color: s.color || C.s[i] },
      itemStyle: { color: s.color || C.s[i] }, areaStyle: s.area ? { color: (s.color || C.s[i]) + "22" } : undefined,
      markLine: s.markLine,
    })),
  });
}
/* 案件量：週模式用日均，避免頭尾不滿一週的期間看起來像掉量 */
function volChart(id, ps) {
  const per = p => S.gran === "day" ? 1 : Math.max(1, p.span);
  const r1 = x => Math.round(x * 10) / 10;
  return lineChart(id, ps.map(p => p.label), [
    { name: "全部案件", data: ps.map(p => ({ value: r1(p.a.n / per(p)), n: p.a.n })), area: true },
    { name: "危急個案", data: ps.map(p => ({ value: r1((p.a.c.critical || 0) / per(p)), n: p.a.c.critical || 0 })), color: C.s[1] },
  ], { yMin: 0, yName: S.gran === "day" ? "件" : "件／日" });
}
/* 前期資料是否足夠比較（前期有資料的天數 ≥ 本期的 80%） */
function prevOk(a, pa) { return pa && pa.n > 0 && pa.days.size >= 0.8 * a.days.size; }

/* 橫條：items [{name, value, label, color, tip}] */
function barH(id, items, o = {}) {
  const el = document.getElementById(id);
  if (el && !o.fixedHeight) el.style.height = Math.max(160, items.length * 26 + 40) + "px";
  const fmtV = o.pct ? (v => fmtPct(v)) : (o.min ? (v => fmtMin(v)) : (v => fmtInt(v)));
  return mk(id, {
    grid: GRID({ top: 8, right: 70 }),
    tooltip: TT({ trigger: "item", formatter: p => `<b>${esc(p.name)}</b><br>${p.data.tip || fmtV(p.value)}` }),
    xAxis: AX({ type: "value", max: o.max, axisLabel: { color: C.muted, fontSize: 11, formatter: o.pct ? (v => Math.round(v * 100) + "%") : undefined } }),
    yAxis: AX({ type: "category", inverse: true, data: items.map(i => i.name), axisLabel: { color: C.text, fontSize: 12, width: 120, overflow: "truncate" } }),
    series: [{
      type: "bar", barMaxWidth: 14, barMinHeight: 2,
      data: items.map(i => ({ value: i.value, tip: i.tip, itemStyle: { color: i.color || C.s[0], borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: "right", color: C.text, fontSize: 11, formatter: p => items[p.dataIndex].label ?? fmtV(p.value) },
      markLine: o.markLine,
    }],
  });
}
/* 時段×星期熱圖 */
function heatChart(id, hw) {
  const data = [];
  let mx = 1;
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) { const v = hw[d * 24 + h]; mx = Math.max(mx, v); data.push([h, d, v]); }
  return mk(id, {
    grid: GRID({ top: 8, bottom: 40, left: 8 }),
    tooltip: TT({ formatter: p => `星期${DOW[p.data[1]]} ${p.data[0]}:00–${p.data[0]}:59<br>${p.data[2]} 件` }),
    xAxis: AX({ type: "category", data: [...Array(24).keys()].map(h => String(h)), splitLine: { show: false }, axisLabel: { color: C.muted, fontSize: 10, interval: 2 } }),
    yAxis: AX({ type: "category", data: DOW.map(d => "週" + d), inverse: true, splitLine: { show: false } }),
    visualMap: { min: 0, max: mx, orient: "horizontal", left: "center", bottom: 0, itemWidth: 10, itemHeight: 120,
      inRange: { color: C.seq }, textStyle: { color: C.muted, fontSize: 11 }, calculable: false },
    series: [{ type: "heatmap", data, itemStyle: { borderColor: C.panel, borderWidth: 2, borderRadius: 3 },
      emphasis: { itemStyle: { borderColor: "#e6ebf5", borderWidth: 1 } } }],
  });
}
/* 時間區段分布（盒鬚：P10/P25/P50/P75/P90） */
function boxChart(id, stages, o = {}) {
  const rows = stages.filter(s => s.arr && s.arr.length);
  const el = document.getElementById(id);
  if (el) el.style.height = Math.max(180, rows.length * 44 + 50) + "px";
  return mk(id, {
    grid: GRID({ top: 10, right: 20 }),
    tooltip: TT({ trigger: "item", formatter: p => {
      const r = rows[p.dataIndex];
      if (!r) return "";
      const q = [0.1, 0.25, 0.5, 0.75, 0.9].map(x => fmtMin(quant(r.arr, x)));
      return `<b>${esc(r.name)}</b>（n=${r.arr.length}）<br>P10 ${q[0]}・P25 ${q[1]}<br><b>中位 ${q[2]}</b>・P75 ${q[3]}<br>P90 ${q[4]} 分`;
    } }),
    xAxis: AX({ type: "value", name: "分鐘", nameLocation: "end", min: 0 }),
    yAxis: AX({ type: "category", inverse: true, data: rows.map(r => r.name), splitLine: { show: false }, axisLabel: { color: C.text, fontSize: 12, width: 110, overflow: "truncate" } }),
    series: [{
      type: "boxplot", boxWidth: [8, 16],
      data: rows.map(r => [0.1, 0.25, 0.5, 0.75, 0.9].map(x => +quant(r.arr, x).toFixed(1))),
      itemStyle: { color: C.s[0] + "55", borderColor: C.s[0], borderWidth: 1.5 },
      markLine: o.thr ? { silent: true, symbol: "none", lineStyle: { color: C.warning, type: "dashed" }, label: { color: C.warning, formatter: o.thrLabel || "{c}" }, data: [{ xAxis: o.thr }] } : undefined,
    }],
  });
}
/* 直方圖（1 分鐘一格） */
function histChart(id, arr, o = {}) {
  const bin = o.bin || 1, cap = o.cap || 40;
  const nb = Math.ceil(cap / bin);
  const counts = new Array(nb + 1).fill(0);
  for (const x of arr || []) counts[Math.min(nb, Math.floor(x / bin))]++;
  const labels = counts.map((_, i) => i === nb ? `≥${cap}` : String(i * bin));
  return mk(id, {
    grid: GRID({ top: 16 }),
    tooltip: TT({ trigger: "axis", formatter: ps => {
      const i = ps[0].dataIndex;
      return i === nb ? `≥${cap} 分：${counts[i]} 件` : `${i * bin}–${(i + 1) * bin} 分：${counts[i]} 件`;
    } }),
    xAxis: AX({ type: "category", data: labels, name: "分", splitLine: { show: false }, axisLabel: { color: C.muted, fontSize: 10, interval: Math.max(0, Math.round(nb / 10) - 1) } }),
    yAxis: AX({ type: "value", name: "件" }),
    series: [{
      type: "bar", barCategoryGap: "12%",
      data: counts.map((v, i) => ({ value: v, itemStyle: { color: o.thr != null && i * bin >= o.thr ? C.s[1] : C.s[0], borderRadius: [3, 3, 0, 0] } })),
      markLine: o.thr != null ? { silent: true, symbol: "none", lineStyle: { color: C.warning, type: "dashed" },
        label: { color: C.warning, formatter: `門檻 ${o.thr} 分` }, data: [{ xAxis: String(Math.round(o.thr / bin)) }] } : undefined,
    }],
  });
}
/* Funnel plot：pts [{name,num,den,sel}] */
function funnelChart(id, pts, p0, ind) {
  const valid = pts.filter(p => p.den > 0);
  const maxN = Math.max(10, ...valid.map(p => p.den)) * 1.08;
  const lim = z => {
    const out = [];
    for (let i = 0; i <= 120; i++) {
      const n = 1 + (maxN - 1) * Math.pow(i / 120, 1.6);
      const se = Math.sqrt(p0 * (1 - p0) / n);
      out.push([+n.toFixed(2), Math.min(1, Math.max(0, p0 + z * se))]);
    }
    return out;
  };
  const limitLine = (z, name, dashed) => ({ name, type: "line", data: lim(z), showSymbol: false, silent: true,
    itemStyle: { color: C.muted }, lineStyle: { width: 1.2, color: C.muted, type: dashed ? "dashed" : "solid", opacity: dashed ? 0.8 : 0.6 } });
  const dots = valid.map(p => {
    const st = funnelStatus(p.num, p.den, p0, ind);
    return { value: [p.den, p.num / p.den], name: p.name, num: p.num, st,
      symbolSize: p.sel ? 14 : 9,
      itemStyle: { color: p.sel ? C.s[1] : C.s[0], borderColor: C.panel, borderWidth: 2 },
      label: { show: !!p.sel || st.cls === "st-bad" || st.cls === "st-warn", formatter: p.name.replace("分隊", ""), position: "right", color: C.text, fontSize: 11 } };
  });
  return mk(id, {
    grid: GRID({ top: 30, right: 24, bottom: 26 }),
    legend: LEG({ data: ["95% 界限", "99.8% 界限"] }),
    tooltip: TT({ trigger: "item", formatter: p => p.seriesType === "scatter"
      ? `<b>${esc(p.data.name)}</b><br>${fmtPct(p.data.value[1])}（${p.data.num}/${p.data.value[0]}）<br><span class="${p.data.st.cls}">${p.data.st.ic} ${p.data.st.t}</span><br><span style="color:${C.muted}">全區 ${fmtPct(p0)}</span>` : "" }),
    xAxis: AX({ type: "value", name: "分母（件）", nameLocation: "middle", nameGap: 22, min: 0, max: Math.ceil(maxN) }),
    yAxis: AX({ type: "value", min: 0, max: v => Math.min(1, Math.ceil((v.max + 0.05) * 10) / 10), axisLabel: { color: C.muted, fontSize: 11, formatter: v => Math.round(v * 100) + "%" } }),
    series: [
      limitLine(1.96, "95% 界限", true), { ...limitLine(-1.96, "95% 界限", true) },
      limitLine(3.09, "99.8% 界限", false), { ...limitLine(-3.09, "99.8% 界限", false) },
      { name: "_center", type: "line", data: [[0, p0], [maxN, p0]], showSymbol: false, silent: true, lineStyle: { color: C.text, width: 1, opacity: 0.6 } },
      { name: "分隊", type: "scatter", data: dots, z: 5 },
    ],
  });
}
/* p 管制圖：pts [{label,num,den}] → 回傳訊號文字 */
function pChart(id, pts, ind) {
  const tn = pts.reduce((s, p) => s + p.num, 0), td = pts.reduce((s, p) => s + p.den, 0);
  const pbar = td ? tn / td : 0;
  const ucl = [], lcl = [], data = [];
  const signals = [];
  pts.forEach((p, i) => {
    if (!p.den) { ucl.push(null); lcl.push(null); data.push({ value: null }); return; }
    const se = Math.sqrt(pbar * (1 - pbar) / p.den);
    const u = Math.min(1, pbar + 3 * se), l = Math.max(0, pbar - 3 * se);
    ucl.push(+u.toFixed(4)); lcl.push(+l.toFixed(4));
    const v = p.num / p.den;
    const out = v > u || v < l;
    if (out) signals.push(`${p.label} 超出管制界限（${fmtPct(v)}）`);
    data.push({ value: v, num: p.num, den: p.den, itemStyle: out ? { color: C.critical } : undefined, symbolSize: out ? 10 : 6 });
  });
  // 規則 2：連續 8 點在中心線同一側
  let run = 0, side = 0;
  pts.forEach((p, i) => {
    if (!p.den) return;
    const s = Math.sign(p.num / p.den - pbar);
    if (s !== 0 && s === side) run++; else { side = s; run = s ? 1 : 0; }
    if (run === 8) signals.push(`至 ${p.label} 連續 8 期在中心線${side > 0 ? "上" : "下"}方（持續偏移）`);
  });
  mk(id, {
    grid: GRID({ top: 30 }),
    legend: LEG({ data: [ind.name, "中心線", "管制界限 ±3σ"] }),
    tooltip: TT({ trigger: "axis", formatter: ps => {
      const d = ps.find(p => p.seriesName === ind.name);
      let s = `<b>${esc(ps[0].axisValueLabel)}</b>`;
      if (d && d.data && d.data.value != null) s += `<br>${esc(ind.name)} ${fmtPct(d.data.value)}（${d.data.num}/${d.data.den}）`;
      const u = ps.find(p => p.seriesName === "管制界限 ±3σ");
      if (u && u.data != null) s += `<br><span style="color:${C.muted}">UCL ${fmtPct(ucl[u.dataIndex])}・LCL ${fmtPct(lcl[u.dataIndex])}</span>`;
      return s;
    } }),
    xAxis: AX({ type: "category", data: pts.map(p => p.label), splitLine: { show: false } }),
    yAxis: AX({ type: "value", min: v => Math.max(0, Math.floor((v.min - 0.05) * 10) / 10), max: v => Math.min(1, Math.ceil((v.max + 0.05) * 10) / 10), axisLabel: { color: C.muted, fontSize: 11, formatter: v => Math.round(v * 100) + "%" } }),
    series: [
      { name: "管制界限 ±3σ", type: "line", step: "middle", data: ucl, showSymbol: false, lineStyle: { color: C.muted, type: "dashed", width: 1.2 }, itemStyle: { color: C.muted } },
      { name: "_lcl", type: "line", step: "middle", data: lcl, showSymbol: false, lineStyle: { color: C.muted, type: "dashed", width: 1.2 } },
      { name: "中心線", type: "line", data: pts.map(() => pbar), showSymbol: false, lineStyle: { color: C.text, width: 1, opacity: 0.7 }, itemStyle: { color: C.text } },
      { name: ind.name, type: "line", data, connectNulls: true, symbolSize: 6, lineStyle: { color: C.s[0], width: 2 }, itemStyle: { color: C.s[0] } },
    ],
  });
  return { pbar, signals, tn, td };
}
/* 檢傷一致性矩陣 */
function triageChart(id, a) {
  const data = [];
  let mx = 1;
  for (let p = 1; p <= 5; p++) for (let e = 1; e <= 5; e++) {
    const v = a.c[`tri_pair:${p}-${e}`] || 0;
    mx = Math.max(mx, v);
    data.push([e - 1, p - 1, v]);
  }
  const items = data.map(d => ({ value: d, label: { color: d[2] > mx * 0.55 ? "#0b1220" : "#e6ebf5" } }));
  return mk(id, {
    grid: GRID({ top: 10, bottom: 46, left: 8 }),
    tooltip: TT({ formatter: q => { const d = q.value; return `到院前 ${d[1] + 1} 級 → 急診 ${d[0] + 1} 級<br>${d[2]} 件${d[0] === d[1] ? "（一致）" : d[1] > d[0] ? "（到院前低估）" : "（到院前高估）"}`; } }),
    xAxis: AX({ type: "category", name: "急診檢傷", nameLocation: "middle", nameGap: 24, data: ["1級", "2級", "3級", "4級", "5級"], splitLine: { show: false } }),
    yAxis: AX({ type: "category", name: "到院前", data: ["1級", "2級", "3級", "4級", "5級"], inverse: true, splitLine: { show: false } }),
    visualMap: { show: false, min: 0, max: mx, inRange: { color: C.seq } },
    series: [{ type: "heatmap", data: items, label: { show: true, fontSize: 12, fontWeight: 700, formatter: q => q.value[2] || "" },
      itemStyle: { borderColor: C.panel, borderWidth: 3, borderRadius: 4 } }],
  });
}
/* 案件分布地圖（0.01° 網格） */
function mapView(id, { region = S.region, unit = "" } = {}) {
  const el = document.getElementById(id);
  if (!el || !window.L) { if (el) el.innerHTML = '<div class="note" style="padding:12px">地圖元件載入失敗（可能網路擋住）</div>'; return; }
  const b = bounds();
  const m0 = b.from.slice(0, 7), m1 = b.to.slice(0, 7);
  const pts = new Map();
  for (const [r, u, m, la, lo, n] of D.grid) {
    if ((region !== "all" && r !== region) || (unit && u !== unit) || m < m0 || m > m1) continue;
    const k = la + "," + lo;
    pts.set(k, (pts.get(k) || 0) + n);
  }
  const map = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
  MAPS.push(map);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 16, subdomains: "abcd", attribution: '&copy; OpenStreetMap &copy; CARTO',
  }).addTo(map);
  const latlngs = [];
  for (const [k, n] of pts) {
    const [la, lo] = k.split(",").map(Number);
    latlngs.push([la, lo]);
    L.circleMarker([la, lo], { radius: Math.min(10, 2 + Math.sqrt(n) * 1.1), stroke: false, fillColor: n >= 10 ? C.s[1] : C.s[0], fillOpacity: n >= 10 ? 0.8 : 0.5 })
      .bindTooltip(`約 1 公里網格：${n} 件`).addTo(map);
  }
  if (latlngs.length) map.fitBounds(latlngs, { padding: [16, 16], maxZoom: 13 });
  else map.setView([23.48, 120.45], 11);
}

/* ───────────── 版面零件 ───────────── */
function kpi(name, val, unit, foot) {
  return `<div class="kpi"><div class="k-name" title="${esc(name)}">${esc(name)}</div><div class="k-val">${val}${unit ? `<small>${unit}</small>` : ""}</div><div class="k-foot">${foot || "&nbsp;"}</div></div>`;
}
function deltaFoot(cur, prev, better, kind) {
  if (cur == null || prev == null) return "前期資料不足";
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return "與前期相同";
  const txt = kind === "pct" ? `${d > 0 ? "+" : ""}${(d * 100).toFixed(1)} 個百分點` : kind === "min" ? `${d > 0 ? "+" : ""}${d.toFixed(1)} 分` : `${d > 0 ? "+" : ""}${d.toFixed(1)}`;
  const cls = !better ? "" : ((d > 0) === (better === "high") ? "better" : "worse");
  return `前期比 <span class="${cls}">${d > 0 ? "▲" : "▼"} ${txt}</span>`;
}
function card(title, sub, body, o = {}) {
  return `<div class="card ${o.wide ? "wide" : ""}"><h3>${esc(title)}</h3>${sub ? `<p class="sub">${sub}</p>` : ""}${body}${o.ref ? refLine(o.ref) : ""}</div>`;
}
function refLine(keys) {
  const ks = [].concat(keys).filter(k => REFS[k]);
  if (!ks.length) return "";
  return `<div class="ref">參考：${ks.map(k => `<a href="${REFS[k].u}" target="_blank" rel="noopener">${esc(REFS[k].t.split("（")[0].slice(0, 60))}</a>`).join("；")}</div>`;
}
function chartDiv(id, cls = "") { return `<div id="${id}" class="chart ${cls}"></div>`; }
function indSelect(id, cur, filter = () => true) {
  let h = `<select id="${id}">`;
  for (const g in GROUPS) {
    const items = RATE_IND.filter(i => i.g === g && filter(i));
    if (!items.length) continue;
    h += `<optgroup label="${esc(GROUPS[g])}">` + items.map(i => `<option value="${i.id}" ${i.id === cur ? "selected" : ""}>${esc(i.name)}</option>`).join("") + "</optgroup>";
  }
  return h + "</select>";
}
function coverageNote() {
  const b = bounds();
  const msgs = [];
  for (const r of ["嘉義市", "嘉義縣"]) {
    if (S.region !== "all" && S.region !== r) continue;
    const cov = (D.coverage[r] || []).map(x => x[0]);
    if (!cov.length) continue;
    const inRange = cov.filter(d => d >= b.from && d <= b.to).length;
    const total = dayDiff(b.from, b.to) + 1;
    if (inRange < total) msgs.push(`${r}：所選 ${total} 天中只有 ${inRange} 天有資料（資料自 ${cov.find(d => d >= b.from) || cov[0]} 起）`);
  }
  return msgs.length ? `<div class="warnbox">⚠ ${msgs.map(esc).join("；")}。比率可比較，件數趨勢請留意缺資料的日子。</div>` : "";
}

/* ───────────── 頁面：總覽 ───────────── */
function pageOverview() {
  const a = aggOf(), b = bounds(), pa = aggOf(prevBounds(b));
  const days = Math.max(1, a.days.size);
  const ok = prevOk(a, pa);
  const r = id => rate(a, IND[id]), pr = id => (ok ? rate(pa, IND[id]).p : null);
  const p50 = (ag, k) => quant(ag.v[k], 0.5), p90 = (ag, k) => quant(ag.v[k], 0.9);
  const oh = a.c.ohca || 0;
  let h = coverageNote();
  h += `<div class="kpis">
    ${kpi("案件數", fmtInt(a.n), "件", `日均 ${(a.n / days).toFixed(1)}・${ok ? deltaFoot(a.n / days, pa.n / Math.max(1, pa.days.size), null, "n").replace("前期比", "日均前期比") : "前期資料不足"}`)}
    ${kpi("送醫率", fmtPct(r("transport").p), "", deltaFoot(r("transport").p, pr("transport"), null, "pct"))}
    ${kpi("危急個案", fmtPct(r("critical").p), "", `${fmtInt(a.c.critical || 0)} 件`)}
    ${kpi("反應時間 中位／P90", `${fmtMin(p50(a, "resp"))}<small>／${fmtMin(p90(a, "resp"))}</small>`, "分", deltaFoot(p90(a, "resp"), ok ? p90(pa, "resp") : null, "low", "min").replace("前期比", "P90 前期比"))}
    ${kpi("現場時間 中位", fmtMin(p50(a, "scene")), "分", `P90 ${fmtMin(p90(a, "scene"))} 分`)}
    ${kpi("醫院滯留 中位", fmtMin(p50(a, "wall")), "分", `P90 ${fmtMin(p90(a, "wall"))} 分`)}
    ${kpi("OHCA", fmtInt(oh), "件", `到院前 ROSC ${a.c.ohca_rosc || 0} 件（${fmtPct(r("ohca_rosc").p)}）`)}
    ${kpi("拒送率", fmtPct(r("refuse").p), "", `空跑／誤報 ${fmtPct(r("empty").p)}`)}
  </div>`;
  h += `<div class="section-title">勤務量</div><div class="grid">`;
  h += card("案件量趨勢", S.gran === "day" ? "每日件數；危急個案另列" : "每週「日均」件數（*＝不滿 7 天的週）；危急個案另列", chartDiv("c-vol"));
  h += card("時段 × 星期", "依案發時間；顏色越亮件數越多", chartDiv("c-heat"));
  h += card("案件細項", "依消防局「案件細項」", chartDiv("c-type"));
  h += card("送往醫院", "有送達時間者", chartDiv("c-hosp"));
  h += card("年齡層", "", chartDiv("c-age", "short"));
  h += card("案件分布地圖", "約 1 公里網格；圓越大件數越多，橘色＝≥10 件（以月份篩選，可能比期間略寬）", `<div id="m-all" class="map"></div>`);
  h += card("分隊總表", "點一列進入該分隊；表頭可排序", `<div class="tbl-wrap" id="t-units"></div>`, { wide: true });
  h += `</div>`;
  $("#content").innerHTML = h;

  const ps = periods();
  volChart("c-vol", ps);
  heatChart("c-heat", a.hw);
  barH("c-type", catCounts(a, "type").slice(0, 12).map(([k, v]) => ({ name: k, value: v, label: `${v}（${fmtPct(v / a.n, 0)}）` })));
  const th = a.c.transported || 0;
  barH("c-hosp", catCounts(a, "hosp").slice(0, 12).map(([k, v]) => ({ name: k, value: v, label: `${v}（${fmtPct(v / th, 0)}）` })));
  const ages = ["<18", "18-64", "65-79", "≥80", "不明"];
  barH("c-age", ages.map(k => ({ name: k, value: a.c["age:" + k] || 0, label: `${a.c["age:" + k] || 0}（${fmtPct((a.c["age:" + k] || 0) / a.n, 0)}）` })), { fixedHeight: true });
  mapView("m-all");
  unitTable("t-units");
}
let UNIT_SORT = { k: "n", d: -1 };
function unitTable(id) {
  const rows = unitsOf(S.region).map(([r, u]) => {
    const a = aggOf({ region: r, unit: u });
    return {
      r, u, n: a.n, days: a.days.size,
      tr: rate(a, IND.transport).p, cr: rate(a, IND.critical).p,
      r50: quant(a.v.resp, 0.5), r90: quant(a.v.resp, 0.9), s50: quant(a.v.scene, 0.5), w50: quant(a.v.wall, 0.5),
      oh: a.c.ohca || 0, ro: a.c.ohca_rosc || 0, un: rate(a, IND.tri_unrated).p, rr: rate(a, IND.dq_rr18).p,
    };
  }).filter(x => x.n > 0);
  const cols = [
    ["u", "分隊"], ...(S.region === "all" ? [["r", "地區"]] : []), ["n", "案件"], ["tr", "送醫%"], ["cr", "危急%"],
    ["r50", "反應P50"], ["r90", "反應P90"], ["s50", "現場P50"], ["w50", "滯留P50"], ["oh", "OHCA"], ["ro", "ROSC"],
    ["un", "檢傷未評%"], ["rr", "RR=18%"],
  ];
  const k = UNIT_SORT.k, d = UNIT_SORT.d;
  rows.sort((x, y) => ((x[k] ?? -1) > (y[k] ?? -1) ? 1 : (x[k] ?? -1) < (y[k] ?? -1) ? -1 : 0) * d);
  const maxN = Math.max(1, ...rows.map(x => x.n));
  const f = (c, x) => {
    const v = x[c];
    if (c === "u" || c === "r") return esc(v);
    if (c === "n") return `${v}<span class="bar" style="width:${Math.round(v / maxN * 40)}px"></span>`;
    if (["tr", "cr", "un", "rr"].includes(c)) return fmtPct(v, 0);
    if (["r50", "r90", "s50", "w50"].includes(c)) return fmtMin(v);
    return fmtInt(v);
  };
  let h = `<table class="tbl"><thead><tr>${cols.map(([c, t]) => `<th data-k="${c}" class="${c === k ? "sorted" : ""}">${t}${c === k ? (d > 0 ? " ↑" : " ↓") : ""}</th>`).join("")}</tr></thead><tbody>`;
  for (const x of rows) h += `<tr data-u="${esc(x.u)}" style="cursor:pointer">${cols.map(([c]) => `<td>${f(c, x)}</td>`).join("")}</tr>`;
  h += "</tbody></table>";
  const el = document.getElementById(id);
  el.innerHTML = h;
  el.querySelectorAll("th").forEach(th => th.onclick = () => {
    const kk = th.dataset.k;
    UNIT_SORT = { k: kk, d: UNIT_SORT.k === kk ? -UNIT_SORT.d : (kk === "u" || kk === "r" ? 1 : -1) };
    unitTable(id);
  });
  el.querySelectorAll("tr[data-u]").forEach(tr => tr.onclick = () => { S.unit = tr.dataset.u; go("unit"); });
}

/* ───────────── 頁面：時效 ───────────── */
function pageTime() {
  const a = aggOf(), pa0 = aggOf(prevBounds(bounds()));
  const pa = prevOk(a, pa0) ? pa0 : { n: 0, v: {}, c: {} };
  const thr = +S.thr || 8;
  const q = (ag, k, p) => quant(ag.v[k], p);
  const le = (arr, t) => arr && arr.length ? arr.filter(x => x <= t).length / arr.length : null;
  let h = coverageNote();
  h += `<div class="kpis">
    ${kpi("反應時間 中位", fmtMin(q(a, "resp", 0.5)), "分", deltaFoot(q(a, "resp", 0.5), pa.n ? q(pa, "resp", 0.5) : null, "low", "min"))}
    ${kpi("反應時間 P90", fmtMin(q(a, "resp", 0.9)), "分", deltaFoot(q(a, "resp", 0.9), pa.n ? q(pa, "resp", 0.9) : null, "low", "min"))}
    ${kpi(`反應 ≤${thr} 分達成率`, fmtPct(le(a.v.resp, thr)), "", `n=${fmtInt((a.v.resp || []).length)}`)}
    ${kpi("現場時間 中位／P90", `${fmtMin(q(a, "scene", 0.5))}<small>／${fmtMin(q(a, "scene", 0.9))}</small>`, "分", "")}
    ${kpi("運送時間 中位", fmtMin(q(a, "trans", 0.5)), "分", `P90 ${fmtMin(q(a, "trans", 0.9))} 分`)}
    ${kpi("到院前總時間 中位", fmtMin(q(a, "total", 0.5)), "分", `P90 ${fmtMin(q(a, "total", 0.9))} 分`)}
    ${kpi("醫院滯留 中位／P90", `${fmtMin(q(a, "wall", 0.5))}<small>／${fmtMin(q(a, "wall", 0.9))}</small>`, "分", "送達→離開醫院")}
    ${kpi("勤務總時間 中位", fmtMin(q(a, "cycle", 0.5)), "分", "出勤→返隊待命")}
  </div>`;
  h += `<p class="note" style="margin:10px 2px 0">依國際慣例同時看中位數與 P90（90th percentile）：平均或中位會掩蓋長尾。時間間隔類比較適合當「營運指標」看，不宜單獨當臨床品質判斷（Pap 2022）。</p>`;
  h += `<div class="grid">`;
  h += card("各時段分布", "盒子＝P25–P75、中線＝中位、鬚＝P10–P90", chartDiv("c-box"), { ref: ["nhs"] });
  h += card("反應時間趨勢（中位＋P90）", `每${S.gran === "day" ? "日" : "週"}；虛線＝門檻 ${thr} 分（設定頁可改）`, chartDiv("c-rt"), { ref: ["nhs", "blackwell"] });
  h += card("反應時間分布", `每格 1 分鐘；橘色＝超過門檻 ${thr} 分`, chartDiv("c-hist"));
  h += card(`反應時間 ≤${thr} 分 達成率`, "每期達成比例", chartDiv("c-rtle"));
  h += card("各分隊反應時間 P90", "長條＝P90，標籤＝中位／P90；虛線＝全區 P90", chartDiv("c-unit-rt"), { ref: ["funnel"] });
  h += card("各醫院滯留時間（送達→離開醫院）", "長條＝中位，標籤＝中位／P90（n）；反映急診交接與床邊等待", chartDiv("c-wall"), { ref: ["wall"] });
  h += card("重點病人現場時間", "危急創傷建議 ≤10 分、疑似中風／胸痛 ≤15 分", chartDiv("c-scene"), { ref: ["nemsqa", "montana"] });
  h += card("現場時間趨勢（中位＋P90）", "", chartDiv("c-st"));
  h += `</div>`;
  $("#content").innerHTML = h;

  boxChart("c-box", [
    { name: "反應（出勤→到達）", arr: a.v.resp }, { name: "現場（到達→離開）", arr: a.v.scene },
    { name: "運送（離開→送達）", arr: a.v.trans }, { name: "醫院滯留", arr: a.v.wall }, { name: "到院前總時間", arr: a.v.total },
  ]);
  const ps = periods();
  const mlThr = { silent: true, symbol: "none", lineStyle: { color: C.warning, type: "dashed" }, label: { color: C.warning, formatter: `${thr} 分` }, data: [{ yAxis: thr }] };
  lineChart("c-rt", ps.map(p => p.label), [
    { name: "中位", data: ps.map(p => ({ value: quant(p.a.v.resp, 0.5), n: (p.a.v.resp || []).length })) },
    { name: "P90", data: ps.map(p => ({ value: quant(p.a.v.resp, 0.9), n: (p.a.v.resp || []).length })), color: C.s[1], markLine: mlThr },
  ], { min: true, yMin: 0 });
  histChart("c-hist", a.v.resp, { thr, cap: 30 });
  lineChart("c-rtle", ps.map(p => p.label), [
    { name: `≤${thr} 分`, data: ps.map(p => { const arr = p.a.v.resp || []; const k = arr.filter(x => x <= thr).length; return { value: arr.length ? k / arr.length : null, num: k, den: arr.length }; }), area: true },
  ], { pct: true, yMin: 0, yMax: 1 });
  const units = unitsOf(S.region).map(([r, u]) => ({ u, a: aggOf({ region: r, unit: u }) })).filter(x => (x.a.v.resp || []).length >= 5);
  const allP90 = quant(a.v.resp, 0.9);
  barH("c-unit-rt", units.map(x => ({ name: x.u, value: +quant(x.a.v.resp, 0.9).toFixed(1),
    label: `${fmtMin(quant(x.a.v.resp, 0.5))}／${fmtMin(quant(x.a.v.resp, 0.9))}`,
    tip: `中位 ${fmtMin(quant(x.a.v.resp, 0.5))} 分・P90 ${fmtMin(quant(x.a.v.resp, 0.9))} 分（n=${x.a.v.resp.length}）` })).sort((x, y) => y.value - x.value),
  { min: true, markLine: { silent: true, symbol: "none", lineStyle: { color: C.text, type: "dashed", opacity: 0.6 }, label: { show: false }, data: [{ xAxis: allP90 }] } });
  const wallItems = Object.keys(a.v).filter(k => k.startsWith("wall@")).map(k => ({ k: k.slice(5), arr: a.v[k] }))
    .filter(x => x.arr.length >= 5).sort((x, y) => quant(y.arr, 0.5) - quant(x.arr, 0.5));
  barH("c-wall", wallItems.map(x => ({ name: x.k, value: +quant(x.arr, 0.5).toFixed(1), label: `${fmtMin(quant(x.arr, 0.5))}／${fmtMin(quant(x.arr, 0.9))}（${x.arr.length}）`,
    tip: `中位 ${fmtMin(quant(x.arr, 0.5))}・P90 ${fmtMin(quant(x.arr, 0.9))} 分（n=${x.arr.length}）` })), { min: true });
  boxChart("c-scene", [
    { name: "全部案件", arr: a.v.scene }, { name: "危急個案", arr: a.v.crit_scene }, { name: "危急創傷", arr: a.v.trauma_crit_scene },
    { name: "疑似中風", arr: a.v.stroke_scene }, { name: "胸痛", arr: a.v.chest_scene }, { name: "OHCA", arr: a.v.ohca_scene },
  ]);
  lineChart("c-st", ps.map(p => p.label), [
    { name: "中位", data: ps.map(p => ({ value: quant(p.a.v.scene, 0.5), n: (p.a.v.scene || []).length })) },
    { name: "P90", data: ps.map(p => ({ value: quant(p.a.v.scene, 0.9), n: (p.a.v.scene || []).length })), color: C.s[1] },
  ], { min: true, yMin: 0 });
}

/* ───────────── 頁面：臨床 ───────────── */
function rateBars(id, a, ids) {
  const items = ids.map(i => IND[i]).filter(Boolean).map(ind => {
    const r = rate(a, ind);
    const small = r.den < (ind.minDen || 1);
    return { name: ind.name, value: r.p ?? 0, color: small ? C.muted : C.s[0],
      label: r.den ? `${fmtPct(r.p, 0)}（${r.num}/${r.den}）${small ? " 樣本少" : ""}` : "無個案",
      tip: `${esc(ind.desc)}<br><b>${fmtPct(r.p)}</b>（${r.num}/${r.den}）` };
  });
  barH(id, items, { pct: true, max: 1 });
}
function pageClinical() {
  const a = aggOf();
  const oh = a.c.ohca || 0;
  const ra = id => rate(a, IND[id]);
  let h = coverageNote();
  h += `<div class="section-title">OHCA 到院前心跳停止</div><div class="kpis">
    ${kpi("OHCA 件數", fmtInt(oh), "件", `內科 ${a.c.ohca_medical || 0}・創傷 ${a.c.ohca_trauma || 0}`)}
    ${kpi("旁觀者 CPR", fmtPct(ra("ohca_bcpr").p), "", `${a.c.ohca_bcpr || 0}/${oh}・CARES 全美 41.2%`)}
    ${kpi("到院前 ROSC", fmtPct(ra("ohca_rosc").p), "", `${a.c.ohca_rosc || 0}/${oh}`)}
    ${kpi("到達→首劑 Epi 中位", fmtMin(quant(a.v.ohca_epi, 0.5)), "分", `n=${(a.v.ohca_epi || []).length}・P90 ${fmtMin(quant(a.v.ohca_epi, 0.9))}`)}
  </div><div class="grid">`;
  h += card("OHCA 處置流程（Utstein 風格）", "各項 ÷ OHCA 總數；非嚴格漏斗，項目間不一定有先後", `<div class="flow" id="f-ohca"></div>`, { ref: ["utstein", "cares"] });
  h += card("OHCA 處置遵從率", "灰色＝樣本少（不判定好壞）", chartDiv("c-ohca"), { ref: ["utstein", "aha"] });
  h += card("到達→第一劑 Epinephrine", "OHCA 有給藥且有給藥時間者；每格 1 分鐘", chartDiv("c-epi"), { ref: ["aha"] });
  h += card("OHCA 件數與 ROSC 趨勢", `每${S.gran === "day" ? "日" : "週"}`, chartDiv("c-ohca-t"));
  h += `</div><div class="section-title">疑似腦中風・胸痛</div><div class="grid">`;
  h += card("疑似中風處置", `篩檢陽性 ${a.c.stroke_pos || 0} 件；肢體無力 ${a.c.stroke_weak || 0} 件`, chartDiv("c-stroke"), { ref: ["nemsqa", "nhs", "aha_stroke"] });
  h += card("疑似中風送往醫院", "篩檢陽性者", chartDiv("c-stroke-h", "short"));
  h += card("胸痛／ACS", `胸痛 ${a.c.chest || 0} 件`, chartDiv("c-chest", "short"), { ref: ["nemsqa", "ml"] });
  h += `</div><div class="section-title">內科急症・創傷</div><div class="grid">`;
  h += card("內科急症處置", "意識改變測血糖、低血糖給糖、低血氧給氧", chartDiv("c-med"), { ref: ["nemsqa"] });
  h += card("創傷處置", `創傷（車禍＋創傷）${a.c.trauma || 0} 件；危急創傷 ${a.c.trauma_crit || 0} 件`, chartDiv("c-trauma"), { ref: ["nemsqa"] });
  h += card("危急創傷現場時間分布", "每格 1 分鐘；橘色＝超過 10 分", chartDiv("c-tscene"), { ref: ["nemsqa"] });
  h += card("給氧適當性", "SpO₂ ≥98% 且意識清楚卻給氧（可能過度給氧），僅供討論", `<div class="kpis" style="margin-top:6px">${kpi("可能不必要給氧", fmtInt(a.c.o2_high_spo2 || 0), "件", `低血氧 ${a.c.hypoxia || 0} 件中有給氧 ${a.c.hypoxia_o2 || 0}`)}${kpi("靜脈輸液", fmtInt(a.c.iv || 0), "件", `有給藥 ${a.c.drug || 0} 件`)}</div>`);
  h += `</div>`;
  $("#content").innerHTML = h;

  const flow = [["OHCA 總數", oh], ["有目擊者", a.c.ohca_witnessed], ["旁觀者 CPR", a.c.ohca_bcpr], ["使用 PAD（民眾）", a.c.ohca_pad],
    ["救護人員 AED", a.c.ohca_aed], ["有電擊", a.c.ohca_shock], ["高級呼吸道 SGA", a.c.ohca_sga], ["給 Epinephrine", a.c.ohca_epi],
    ["自動心肺復甦機", a.c.ohca_mcpr], ["到院前 ROSC", a.c.ohca_rosc]];
  $("#f-ohca").innerHTML = flow.map(([k, v]) => `<div class="f-row"><span>${k}</span><div class="f-bar"><span style="width:${oh ? Math.round((v || 0) / oh * 100) : 0}%"></span></div><span class="f-n">${v || 0}${k !== "OHCA 總數" && oh ? `・${fmtPct((v || 0) / oh, 0)}` : ""}</span></div>`).join("");
  rateBars("c-ohca", a, ["ohca_bcpr", "ohca_aed", "ohca_epi", "ohca_sga", "ohca_mcpr", "ohca_etco2", "ohca_rosc"]);
  histChart("c-epi", a.v.ohca_epi, { cap: 30 });
  const ps = periods();
  lineChart("c-ohca-t", ps.map(p => p.label), [
    { name: "OHCA", data: ps.map(p => p.a.c.ohca || 0) },
    { name: "到院前 ROSC", data: ps.map(p => p.a.c.ohca_rosc || 0), color: C.s[2] },
  ], { yMin: 0 });
  rateBars("c-stroke", a, ["stroke_weak_screen", "stroke_fast", "stroke_bg", "stroke_bundle", "stroke_lkw", "stroke_scene15"]);
  barH("c-stroke-h", catCounts(a, "stroke_hosp").map(([k, v]) => ({ name: k, value: v })), { fixedHeight: true });
  rateBars("c-chest", a, ["chest_ekg", "chest_scene15"]);
  rateBars("c-med", a, ["altered_bg", "hypo_tx", "hypoxia_o2"]);
  rateBars("c-trauma", a, ["trauma_cs_doc", "trauma_scene10"]);
  histChart("c-tscene", a.v.trauma_crit_scene, { thr: 10, cap: 30 });
}

/* ───────────── 頁面：分隊 ───────────── */
function pageUnit() {
  const list = unitsOf(S.region).filter(([r, u]) => aggOf({ region: r, unit: u }).n > 0);
  if (!list.length) { $("#content").innerHTML = '<div class="loading">所選期間沒有資料</div>'; return; }
  if (!list.some(([, u]) => u === S.unit)) S.unit = list[0][1];
  const unit = S.unit, reg = regionOfUnit(unit);
  const a = aggOf({ region: reg, unit }), ra = aggOf({ region: reg });
  const peers = unitsOf(reg).map(([r, u]) => ({ u, a: aggOf({ region: r, unit: u }) })).filter(x => x.a.n > 0);
  const vs = (cur, base, better, kind) => {
    if (cur == null || base == null) return `${reg} —`;
    const d = cur - base;
    const cls = !better || Math.abs(d) < 1e-9 ? "" : ((d > 0) === (better === "high") ? "better" : "worse");
    const t = kind === "pct" ? `${(d * 100).toFixed(1)} 點` : `${d.toFixed(1)} 分`;
    return `${reg} ${kind === "pct" ? fmtPct(base) : fmtMin(base)}・<span class="${cls}">${d > 0 ? "+" : ""}${t}</span>`;
  };
  const R = (ag, id) => rate(ag, IND[id]).p;
  const Q = (ag, k, p) => quant(ag.v[k], p);
  let sel = `<select id="sel-unit">`;
  let lastR = "";
  for (const [r, u] of list) {
    if (r !== lastR) { if (lastR) sel += "</optgroup>"; sel += `<optgroup label="${r}">`; lastR = r; }
    sel += `<option ${u === unit ? "selected" : ""}>${esc(u)}</option>`;
  }
  sel += "</optgroup></select>";
  let h = `<div class="tb-row" style="margin-bottom:10px;gap:8px">${sel}<span class="note">與${reg}全區比較；排名只算分母夠大的分隊</span></div>`;
  h += coverageNote();
  h += `<div class="kpis">
    ${kpi("案件數", fmtInt(a.n), "件", `占${reg} ${fmtPct(a.n / Math.max(1, ra.n), 0)}・日均 ${(a.n / Math.max(1, a.days.size)).toFixed(1)}`)}
    ${kpi("送醫率", fmtPct(R(a, "transport")), "", vs(R(a, "transport"), R(ra, "transport"), null, "pct"))}
    ${kpi("危急個案", fmtPct(R(a, "critical")), "", vs(R(a, "critical"), R(ra, "critical"), null, "pct"))}
    ${kpi("反應時間 中位", fmtMin(Q(a, "resp", 0.5)), "分", vs(Q(a, "resp", 0.5), Q(ra, "resp", 0.5), "low", "min"))}
    ${kpi("反應時間 P90", fmtMin(Q(a, "resp", 0.9)), "分", vs(Q(a, "resp", 0.9), Q(ra, "resp", 0.9), "low", "min"))}
    ${kpi("現場時間 中位", fmtMin(Q(a, "scene", 0.5)), "分", vs(Q(a, "scene", 0.5), Q(ra, "scene", 0.5), "low", "min"))}
    ${kpi("OHCA／ROSC", `${a.c.ohca || 0}<small>／${a.c.ohca_rosc || 0}</small>`, "件", `${reg} ${ra.c.ohca || 0}／${ra.c.ohca_rosc || 0}`)}
    ${kpi("檢傷未評", fmtPct(R(a, "tri_unrated")), "", vs(R(a, "tri_unrated"), R(ra, "tri_unrated"), "low", "pct"))}
  </div><div class="grid">`;
  h += card("分隊成績單", "比率指標以 funnel plot 判定（與全區比、考慮樣本數）；▲優於預期 ◯範圍內 ▼需注意（>2SD）▼▼顯著落後（>3SD）", `<div class="tbl-wrap" id="t-score"></div>`, { wide: true, ref: ["funnel", "spiegel"] });
  h += card("Funnel plot：與其他分隊比較", indSelect("sel-funnel", S.funnelInd, i => i.better) + ` <span class="note">橘點＝本分隊</span>`, chartDiv("c-funnel", "tall"), { ref: ["funnel", "spiegel"] });
  h += card("案件量趨勢", S.gran === "day" ? "每日件數" : "每週「日均」件數（*＝不滿 7 天的週）", chartDiv("c-uvol"));
  h += card("反應時間趨勢", "本分隊中位／P90 與全區 P90", chartDiv("c-urt"));
  h += card("時段 × 星期", "", chartDiv("c-uheat"));
  h += card("案件細項", "本分隊件數（括號＝全區占比）", chartDiv("c-utype"));
  h += card("送往醫院", "", chartDiv("c-uhosp"));
  h += card("案件分布地圖", "約 1 公里網格；橘色＝≥10 件", `<div id="m-unit" class="map"></div>`);
  h += `</div>`;
  $("#content").innerHTML = h;
  $("#sel-unit").onchange = e => { S.unit = e.target.value; saveState(); render(); };
  $("#sel-funnel").onchange = e => { S.funnelInd = e.target.value; saveState(); render(); };

  // 成績單
  let t = `<table class="tbl defs-score"><thead><tr><th>指標</th><th>本分隊</th><th>${reg}</th><th>排名</th><th>判定</th></tr></thead><tbody>`;
  for (const g in GROUPS) {
    const rs = RATE_IND.filter(i => i.g === g);
    const ts = TIME_IND.filter(i => i.g === g && i.better);
    if (!rs.length && !ts.length) continue;
    t += `<tr><td colspan="5" style="color:${C.muted};font-size:12px;padding-top:10px">${esc(GROUPS[g])}</td></tr>`;
    for (const ind of rs) {
      const r = rate(a, ind), b = rate(ra, ind);
      let rank = "—";
      if (ind.better && r.den >= (ind.minDen || 1)) {
        const ok = peers.map(x => rate(x.a, ind)).filter(x => x.den >= (ind.minDen || 1)).map(x => x.p);
        const better = ok.filter(p => ind.better === "high" ? p > r.p : p < r.p).length;
        rank = `${better + 1}/${ok.length}`;
      }
      const st = ind.better ? funnelStatus(r.num, r.den, b.p, ind) : { cls: "st-na", ic: "", t: "（不判定）" };
      t += `<tr><td title="${esc(ind.desc)}">${esc(ind.name)}</td><td>${fmtPct(r.p)} <span class="note">${r.num}/${r.den}</span></td><td>${fmtPct(b.p)}</td><td>${rank}</td><td><span class="status ${st.cls}"><i>${st.ic}</i>${st.t}</span></td></tr>`;
    }
    for (const ti of ts) {
      const arr = a.v[ti.id] || [], m = quant(arr, 0.5), bm = quant(ra.v[ti.id], 0.5);
      let rank = "—";
      if (arr.length >= 5) {
        const ok = peers.filter(x => (x.a.v[ti.id] || []).length >= 5).map(x => quant(x.a.v[ti.id], 0.5));
        rank = `${ok.filter(v => v < m).length + 1}/${ok.length}`;
      }
      t += `<tr><td title="${esc(ti.sub)}">${esc(ti.name)}（中位）</td><td>${fmtMin(m)} 分 <span class="note">n=${arr.length}</span></td><td>${fmtMin(bm)} 分</td><td>${rank}</td><td><span class="status st-na">${arr.length < 5 ? "樣本少" : "時間越短排名越前"}</span></td></tr>`;
    }
  }
  $("#t-score").innerHTML = t + "</tbody></table>";

  const ind = IND[S.funnelInd] || IND.tri_unrated;
  funnelChart("c-funnel", peers.map(x => ({ name: x.u, ...rate(x.a, ind), sel: x.u === unit })), rate(ra, ind).p, ind);
  const ps = periods({ region: reg, unit }), pr = periods({ region: reg });
  volChart("c-uvol", ps);
  lineChart("c-urt", ps.map(p => p.label), [
    { name: "本隊中位", data: ps.map(p => ({ value: quant(p.a.v.resp, 0.5), n: (p.a.v.resp || []).length })) },
    { name: "本隊 P90", data: ps.map(p => ({ value: quant(p.a.v.resp, 0.9), n: (p.a.v.resp || []).length })), color: C.s[1] },
    { name: `${reg} P90`, data: pr.map(p => ({ value: quant(p.a.v.resp, 0.9), n: (p.a.v.resp || []).length })), color: C.muted, dashed: true },
  ], { min: true, yMin: 0 });
  heatChart("c-uheat", a.hw);
  barH("c-utype", catCounts(a, "type").slice(0, 10).map(([k, v]) => ({ name: k, value: v, label: `${v}（全區 ${fmtPct((ra.c["type:" + k] || 0) / ra.n, 0)}）` })));
  barH("c-uhosp", catCounts(a, "hosp").slice(0, 10).map(([k, v]) => ({ name: k, value: v, label: `${v}（${fmtPct(v / Math.max(1, a.c.transported || 0), 0)}）` })));
  mapView("m-unit", { region: reg, unit });
}

/* ───────────── 頁面：品管（SPC／funnel／紀錄品質） ───────────── */
function pageQuality() {
  const a = aggOf();
  const R = id => rate(a, IND[id]);
  let h = coverageNote();
  h += `<div class="kpis">
    ${kpi("呼吸次數填 18", fmtPct(R("dq_rr18").p), "", "越低越好；過高＝可能未實測")}
    ${kpi("現場生命徵象完整", fmtPct(R("dq_vs_full").p), "", "")}
    ${kpi("現場血壓有數值", fmtPct(R("dq_bp1").p), "", "第一筆（現場）")}
    ${kpi("到院前檢傷未評", fmtPct(R("tri_unrated").p), "", "")}
    ${kpi("檢傷一致", fmtPct(R("tri_same").p), "", `低估 ${fmtPct(R("tri_under").p)}・高估 ${fmtPct((a.c.tri_over || 0) / Math.max(1, a.c.tri_pair || 0))}`)}
    ${kpi("時間戳缺漏", fmtPct(R("dq_time").p), "", `${a.c.dq_time_missing || 0} 件`)}
  </div><div class="grid">`;
  h += card("指標管制圖（p-chart）", indSelect("sel-p", S.pInd) + ` <span class="note">每${S.gran === "day" ? "日" : "週"}一點；界限隨分母變寬窄</span>`, chartDiv("c-p", "tall") + `<div id="p-sig" class="note" style="margin-top:6px"></div>`, { wide: true, ref: ["spc", "benneyan"] });
  h += card("Funnel plot：各分隊比較", indSelect("sel-funnel2", S.funnelInd, i => i.better) + ` <span class="note">界限外且標名稱者＝需注意${S.region === "all" ? "；目前市縣合併計算中心線，建議選單一地區" : ""}</span>`, chartDiv("c-funnel2", "tall"), { ref: ["funnel", "spiegel"] });
  h += card("檢傷一致性", "到院前檢傷 vs 急診檢傷（兩邊都有級數的送醫案件）；對角線＝一致", chartDiv("c-tri"));
  h += card("各分隊指標排行", indSelect("sel-dq", S.dqInd), chartDiv("c-dq"));
  h += `</div>`;
  $("#content").innerHTML = h;
  $("#sel-p").onchange = e => { S.pInd = e.target.value; saveState(); render(); };
  $("#sel-funnel2").onchange = e => { S.funnelInd = e.target.value; saveState(); render(); };
  $("#sel-dq").onchange = e => { S.dqInd = e.target.value; saveState(); render(); };

  const pind = IND[S.pInd] || IND.dq_rr18;
  const ps = periods();
  const res = pChart("c-p", ps.map(p => ({ label: p.label, ...rate(p.a, pind) })), pind);
  $("#p-sig").innerHTML = `中心線 ${fmtPct(res.pbar)}（${res.tn}/${res.td}）。` + (res.signals.length
    ? `<span class="st-warn">⚠ 特殊原因訊號：</span>${res.signals.map(esc).join("；")}`
    : "沒有特殊原因訊號（變動都在共同原因範圍內）。") + ` <span class="note">判讀規則：單點出界、連續 8 點同側。</span>`;
  const find = IND[S.funnelInd] || IND.tri_unrated;
  const units = unitsOf(S.region).map(([r, u]) => ({ name: u, ...rate(aggOf({ region: r, unit: u }), find) }));
  funnelChart("c-funnel2", units, rate(a, find).p, find);
  triageChart("c-tri", a);
  const dind = IND[S.dqInd] || IND.dq_rr18;
  const items = unitsOf(S.region).map(([r, u]) => ({ u, ...rate(aggOf({ region: r, unit: u }), dind) }))
    .filter(x => x.den >= (dind.minDen || 1))
    .sort((x, y) => (dind.better === "low" ? y.p - x.p : x.p - y.p));
  barH("c-dq", items.map(x => ({ name: x.u, value: x.p, label: `${fmtPct(x.p, 0)}（${x.num}/${x.den}）` })), {
    pct: true, max: 1,
    markLine: { silent: true, symbol: "none", lineStyle: { color: C.text, type: "dashed", opacity: 0.6 }, label: { show: false }, data: [{ xAxis: rate(a, dind).p || 0 }] },
  });
}

/* ───────────── 頁面：更多（設定、版本、log、定義、文獻） ───────────── */
function pageMore() {
  const gen = D.generated_at.replace("T", " ");
  const cov = Object.entries(D.coverage).map(([r, arr]) => `${r}：${arr.length} 天（${arr[0][0]} ～ ${arr[arr.length - 1][0]}）`).join("<br>");
  const logs = lsGet("debug_log", []);
  let h = `<div class="grid">`;
  h += card("版面與門檻", "", `
    <div class="set-row"><label>版面</label><div class="seg" id="seg-view">${[["auto", "自動"], ["mobile", "手機版"], ["desk", "電腦版"]].map(([k, t]) => `<button data-v="${k}" class="${S.view === k ? "on" : ""}">${t}</button>`).join("")}</div></div>
    <div class="set-row"><label>反應時間門檻（分鐘）</label><input type="number" id="in-thr" min="1" max="60" step="1" value="${S.thr}" style="width:80px"></div>
    <div class="set-row"><label>趨勢圖粒度</label><div class="seg" id="seg-gran2">${[["day", "日"], ["week", "週"]].map(([k, t]) => `<button data-v="${k}" class="${S.gran === k ? "on" : ""}">${t}</button>`).join("")}</div></div>`);
  h += card("資料", "", `
    <div class="set-row"><label>資料產生時間</label><span class="num">${esc(gen)}</span></div>
    <div class="set-row"><label>總筆數</label><span class="num">${fmtInt(D.total)}</span></div>
    <div class="set-row"><label>涵蓋日期</label><span class="note" style="text-align:right">${cov}</span></div>
    <div class="set-row"><label>來源</label><span class="note" style="text-align:right">${esc(D.source)}</span></div>
    <div class="set-row"><span class="note">只含彙總數字（件數與匿名的時間數列），不含任何病人辨識資料。</span><button class="btn" id="btn-reload">重新載入資料</button></div>`);
  h += card("版本控制", "", `
    <div class="set-row"><label>目前版本</label><span class="num">v${BUILD}</span></div>
    <div class="set-row"><label>檢查更新</label><span><span id="upd-msg" class="note"></span> <button class="btn" id="btn-upd">檢查更新</button></span></div>
    <div class="set-row"><span class="note">iPhone 加入主畫面後沒有重新整理鈕：有新版時按「立即更新」會換網址重新載入。</span><button class="btn" id="btn-link">複製加入主畫面用的連結</button></div>`);
  h += card("偵錯 Log", "存在本機瀏覽器（debug_log），不含病人資料", `
    <div class="set-row"><label><input type="checkbox" id="ck-log" ${S.logOn ? "checked" : ""}> 啟用偵錯 Log</label>
      <label style="opacity:${S.logOn ? 1 : .5}"><input type="checkbox" id="ck-logclr" ${S.logClear ? "checked" : ""} ${S.logOn ? "" : "disabled"}> 每次開啟時清空 log</label></div>
    <div class="set-row"><span class="note">${logs.length} 行</span><span><button class="btn" id="btn-logshow">顯示 log</button> <button class="btn" id="btn-logcopy">複製全部</button> <button class="btn" id="btn-logclear">清除</button></span></div>
    <pre class="log" id="log-pre" style="display:none"></pre>`);
  let defs = `<table class="tbl defs"><thead><tr><th>指標</th><th>定義（分子／分母）</th><th>方向</th></tr></thead><tbody>`;
  for (const g in GROUPS) {
    const rs = RATE_IND.filter(i => i.g === g), ts = TIME_IND.filter(i => i.g === g);
    if (!rs.length && !ts.length) continue;
    defs += `<tr><td colspan="3" style="color:${C.muted};font-size:12px;padding-top:10px">${esc(GROUPS[g])}</td></tr>`;
    for (const i of rs) defs += `<tr><td>${esc(i.name)}</td><td>${esc(i.desc)}<br><span class="badge">${i.num} ÷ ${i.den}</span>${i.ref && REFS[i.ref] ? ` <a href="${REFS[i.ref].u}" target="_blank" rel="noopener" class="note">出處</a>` : ""}</td><td>${i.better === "high" ? "越高越好" : i.better === "low" ? "越低越好" : "—"}</td></tr>`;
    for (const i of ts) defs += `<tr><td>${esc(i.name)}</td><td>${esc(i.sub)}（看中位與 P90）${i.ref && REFS[i.ref] ? ` <a href="${REFS[i.ref].u}" target="_blank" rel="noopener" class="note">出處</a>` : ""}</td><td>${i.better === "low" ? "越短越好" : "—"}</td></tr>`;
  }
  defs += "</tbody></table>";
  h += card("指標定義", "要增刪改指標：改 site/indicators.js 與 export_data.py", `<div class="tbl-wrap">${defs}</div>`, { wide: true });
  h += card("參考文獻與案例", "儀表板圖表與指標的出處", `<ol class="refs">${Object.values(REFS).map(r => `<li><a href="${r.u}" target="_blank" rel="noopener">${esc(r.t)}</a></li>`).join("")}</ol>`, { wide: true });
  h += `</div>`;
  $("#content").innerHTML = h;

  document.querySelectorAll("#seg-view button").forEach(b => b.onclick = () => { S.view = b.dataset.v; saveState(); applyView(); render(); });
  document.querySelectorAll("#seg-gran2 button").forEach(b => b.onclick = () => { S.gran = b.dataset.v; saveState(); render(); });
  $("#in-thr").onchange = e => { S.thr = Math.max(1, Math.min(60, +e.target.value || 8)); saveState(); log(`反應時間門檻改為 ${S.thr}`); };
  $("#btn-reload").onclick = () => loadData(true);
  $("#btn-upd").onclick = checkUpdate;
  $("#btn-link").onclick = () => {
    const url = location.href.split("#")[0].split("?")[0] + "#v=" + S.view + "&r=" + encodeURIComponent(S.region);
    copyText(url, "已複製：在 Safari 開這個連結 → 分享 → 加入主畫面");
  };
  $("#ck-log").onchange = e => { S.logOn = e.target.checked; saveState(); render(); };
  $("#ck-logclr").onchange = e => { S.logClear = e.target.checked; saveState(); };
  $("#btn-logshow").onclick = () => { const p = $("#log-pre"); p.style.display = p.style.display === "none" ? "block" : "none"; p.textContent = lsGet("debug_log", []).join("\n"); p.scrollTop = p.scrollHeight; };
  $("#btn-logcopy").onclick = () => copyText(lsGet("debug_log", []).join("\n"), "已複製 log");
  $("#btn-logclear").onclick = () => { lsSet("debug_log", []); render(); };
}
function copyText(t, okMsg) {
  const done = () => alert(okMsg);
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done));
  else fallbackCopy(t, done);
}
function fallbackCopy(t, done) {
  const ta = document.createElement("textarea");
  ta.value = t; document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); done(); } catch (e) { prompt("請手動複製：", t); }
  ta.remove();
}
async function checkUpdate() {
  const msg = $("#upd-msg");
  msg.textContent = "檢查中…";
  try {
    const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const v = await r.json();
    log(`檢查更新：線上 ${v.build}，本機 ${BUILD}`);
    if (v.build && v.build !== BUILD) {
      msg.innerHTML = `有新版 v${esc(v.build)}${v.notes ? "：" + esc(v.notes) : ""} <button class="btn primary" id="btn-go">立即更新</button>`;
      $("#btn-go").onclick = () => { location.replace(location.pathname + "?v=" + encodeURIComponent(v.build) + location.hash); };
    } else msg.textContent = "已是最新版";
  } catch (e) {
    msg.textContent = "檢查失敗：" + e.message;
    log(`檢查更新失敗：${e.message}`);
  }
}

/* ───────────── 外框：導覽、篩選、版面 ───────────── */
const RENDER = { overview: pageOverview, time: pageTime, clinical: pageClinical, unit: pageUnit, quality: pageQuality, more: pageMore };
function go(page) { S.page = page; saveState(); render(); window.scrollTo(0, 0); }
function isDesk() { return S.view === "desk" || (S.view === "auto" && window.innerWidth >= 900); }
function applyView() {
  document.body.classList.toggle("desk", isDesk());
  $("#btn-view").textContent = isDesk() ? "🖥 電腦版" : "📱 手機版";
}
function buildNav() {
  const btn = p => `<button data-p="${p.id}" class="${S.page === p.id ? "on" : ""}"><span class="ic">${p.ic}</span><span>${p.name}</span></button>`;
  $("#nav-m").innerHTML = PAGES.map(btn).join("");
  $("#nav-d").innerHTML = PAGES.map(btn).join("");
  document.querySelectorAll("#nav-m button, #nav-d button").forEach(b => b.onclick = () => go(b.dataset.p));
  $("#side-foot").innerHTML = D ? `v${BUILD}<br>資料 ${esc(D.generated_at.replace("T", " ").slice(0, 16))}` : `v${BUILD}`;
}
function buildFilters() {
  if (S.page === "more") { $("#filters").innerHTML = ""; return; }
  const b = bounds();
  let h = `<div class="seg" id="seg-region">${[["all", "全部"], ["嘉義市", "嘉義市"], ["嘉義縣", "嘉義縣"]].map(([k, t]) => `<button data-v="${k}" class="${S.region === k ? "on" : ""}">${t}</button>`).join("")}</div>`;
  h += `<select id="sel-range">${RANGES.map(([k, t]) => `<option value="${k}" ${S.range === k ? "selected" : ""}>${t}</option>`).join("")}</select>`;
  if (S.range === "custom") h += `<input type="date" id="in-from" value="${b.from}" min="${D.minDate}" max="${D.maxDate}"><input type="date" id="in-to" value="${b.to}" min="${D.minDate}" max="${D.maxDate}">`;
  h += `<div class="seg" id="seg-gran">${[["day", "日"], ["week", "週"]].map(([k, t]) => `<button data-v="${k}" class="${S.gran === k ? "on" : ""}">${t}</button>`).join("")}</div>`;
  h += `<span class="note num">${b.from.slice(5)}～${b.to.slice(5)}</span>`;
  $("#filters").innerHTML = h;
  document.querySelectorAll("#seg-region button").forEach(x => x.onclick = () => { S.region = x.dataset.v; saveState(); render(); });
  document.querySelectorAll("#seg-gran button").forEach(x => x.onclick = () => { S.gran = x.dataset.v; saveState(); render(); });
  $("#sel-range").onchange = e => {
    S.range = e.target.value;
    if (S.range === "custom" && !S.from) { S.from = addDays(D.maxDate, -29); S.to = D.maxDate; }
    saveState(); render();
  };
  if ($("#in-from")) {
    $("#in-from").onchange = e => { S.from = e.target.value; saveState(); render(); };
    $("#in-to").onchange = e => { S.to = e.target.value; saveState(); render(); };
  }
}
function render() {
  if (!D) return;
  disposeAll();
  applyView();
  buildNav();
  buildFilters();
  $("#page-title").textContent = PAGES.find(p => p.id === S.page).name + (S.page === "unit" && S.unit ? "" : "");
  try {
    RENDER[S.page]();
  } catch (e) {
    $("#content").innerHTML = `<div class="warnbox">畫面產生失敗：${esc(e.message)}（詳見 更多 → 偵錯 Log）</div>`;
    log(`[錯誤] render ${S.page}: ${e.stack || e.message}`);
  }
}
async function loadData(force) {
  try {
    const r = await fetch("data/dashboard.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    D = await r.json();
    const ds = D.cells.map(c => c.d).sort();
    D.minDate = ds[0];
    D.maxDate = ds[ds.length - 1];
    MEMO.clear();
    log(`資料載入：${D.total} 筆、${D.cells.length} 格、${D.minDate}～${D.maxDate}（產生 ${D.generated_at}）`);
    render();
    if (force) alert("資料已重新載入");
  } catch (e) {
    $("#content").innerHTML = `<div class="warnbox">讀取資料失敗：${esc(e.message)}</div>`;
    log(`[錯誤] 讀取資料失敗：${e.message}`);
  }
}
let lastDesk = null;
window.addEventListener("resize", () => {
  const d = isDesk();
  if (lastDesk !== null && d !== lastDesk && D) { lastDesk = d; render(); return; }
  lastDesk = d;
  CHARTS.forEach(c => c.resize());
});
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  if (S.logClear) lsSet("debug_log", []);
  log(`===== 啟動 v${BUILD}｜${navigator.userAgent.slice(0, 90)}｜${window.innerWidth}×${window.innerHeight}`);
  $("#btn-view").onclick = () => { S.view = isDesk() ? "mobile" : "desk"; saveState(); render(); };
  applyView();
  lastDesk = isDesk();
  buildNav();
  loadData(false);
});
