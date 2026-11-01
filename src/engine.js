export const LIMITS = { requests: 48, resources: 8, days: 31, units: 20, nodes: 120000 };
const DAY = 86400000;
export const dayNumber = value => {
  if (typeof value !== 'string' || !/^20\d\d-\d{2}-\d{2}$/.test(value)) return NaN;
  const n = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value ? n / DAY : NaN;
};
export const dateString = n => new Date(n * DAY).toISOString().slice(0, 10);
export const borrowerKey = r => r.borrower.trim().toLocaleLowerCase('en');
const text = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
const int = (n, max = 10000) => Number.isSafeInteger(n) && n >= 0 && n <= max;
export function validateBoard(b) {
  const errors = [];
  if (!b || b.schemaVersion !== 1 || !text(b.title, 90) || !['example', 'own'].includes(b.mode)) return ['This is not a BorrowFair version 1 workspace.'];
  if (!Array.isArray(b.resources) || b.resources.length > LIMITS.resources || !Array.isArray(b.requests) || b.requests.length > LIMITS.requests || !Array.isArray(b.pins)) return ['Use at most 8 equipment types and 48 requests.'];
  const ids = new Set();
  for (const r of b.resources) {
    if (!r || !text(r.id, 32) || !/^[a-z][a-z0-9_-]*$/.test(r.id) || ids.has(r.id) || !text(r.name, 60) || !int(r.units, LIMITS.units)) errors.push('Each equipment type needs a unique lowercase ID, a name and 0–20 available units.');
    if (r) ids.add(r.id);
  }
  const requestIds = new Set(), histories = new Map(); let first = Infinity, last = -Infinity;
  for (const r of b.requests) {
    if (!r || !text(r.id, 32) || !/^[a-zA-Z0-9_-]+$/.test(r.id) || requestIds.has(r.id) || !text(r.borrower, 50) || !text(r.purpose, 120) || !int(r.previousLoans, 1000)) { errors.push('Each request needs a unique ID, borrower alias, purpose and 0–1,000 previous loans.'); continue; }
    requestIds.add(r.id);
    const start = dayNumber(r.start), end = dayNumber(r.end), received = dayNumber(r.received);
    if (![start, end, received].every(Number.isFinite) || end <= start || received > start) errors.push(`${r.id}: use real dates; return must follow pickup and request date cannot follow pickup.`);
    first = Math.min(first, start); last = Math.max(last, end);
    const key = borrowerKey(r);
    if (histories.has(key) && histories.get(key) !== r.previousLoans) errors.push(`${r.id}: requests for the same borrower must have the same previous-loan count.`);
    histories.set(key, r.previousLoans);
    if (!r.needs || typeof r.needs !== 'object' || Array.isArray(r.needs) || !Object.keys(r.needs).length || Object.entries(r.needs).some(([id, n]) => !ids.has(id) || !int(n, LIMITS.units) || n < 1)) errors.push(`${r.id}: choose at least one equipment type, with a quantity of 1–20.`);
  }
  if (last - first > LIMITS.days) errors.push('All requests must fit within a 31-day planning window.');
  if (new Set(b.pins).size !== b.pins.length || b.pins.some(id => !requestIds.has(id))) errors.push('Kept requests must be unique request IDs in this workspace.');
  return [...new Set(errors)];
}
export function makeContext(b) {
  const first = b.requests.length ? Math.min(...b.requests.map(r => dayNumber(r.start))) : 0;
  const last = b.requests.length ? Math.max(...b.requests.map(r => dayNumber(r.end))) : first;
  return { first, last, stock: new Map(b.resources.map(r => [r.id, r.units])), usage: new Map(b.resources.map(r => [r.id, new Int16Array(last - first)])), borrowers: new Set() };
}
export function canPlace(r, ctx) {
  if (ctx.borrowers.has(borrowerKey(r))) return false;
  for (const [id, n] of Object.entries(r.needs)) for (let t = dayNumber(r.start) - ctx.first; t < dayNumber(r.end) - ctx.first; t++) if (ctx.usage.get(id)[t] + n > ctx.stock.get(id)) return false;
  return true;
}
function place(r, ctx, direction) {
  if (direction > 0) ctx.borrowers.add(borrowerKey(r)); else ctx.borrowers.delete(borrowerKey(r));
  for (const [id, n] of Object.entries(r.needs)) for (let t = dayNumber(r.start) - ctx.first; t < dayNumber(r.end) - ctx.first; t++) ctx.usage.get(id)[t] += n * direction;
}
export function objective(requests) {
  return [requests.length, -requests.reduce((n, r) => n + r.previousLoans, 0), -requests.reduce((n, r) => n + dayNumber(r.received), 0)];
}
export function comparePlans(a, b) {
  const aa = objective(a), bb = objective(b);
  for (let i = 0; i < 3; i++) if (aa[i] !== bb[i]) return aa[i] - bb[i];
  return b.map(r => r.id).sort().join('|').localeCompare(a.map(r => r.id).sort().join('|'), 'en');
}
export function verifyPlan(b, selected) {
  const errors = validateBoard(b); if (errors.length) return errors;
  if (!Array.isArray(selected) || selected.some(id => !b.requests.some(r => r.id === id)) || new Set(selected).size !== selected.length) return ['The plan contains unknown or repeated request IDs.'];
  const ctx = makeContext(b);
  for (const id of selected) { const r = b.requests.find(x => x.id === id); if (!canPlace(r, ctx)) errors.push(`${id}: equipment capacity or one-request-per-borrower rule is violated.`); else place(r, ctx, 1); }
  for (const id of b.pins) if (!selected.includes(id)) errors.push(`${id}: a kept request is missing.`);
  return errors;
}
export function solve(b, { maxNodes = LIMITS.nodes } = {}) {
  const errors = validateBoard(b); if (errors.length) return { status: 'invalid', errors, selected: [], complete: false };
  const ctx = makeContext(b), kept = b.pins.map(id => b.requests.find(r => r.id === id));
  for (const r of kept) {
    if (!canPlace(r, ctx)) return { status: 'conflict', errors: ['Kept requests conflict with equipment capacity or the one-request-per-borrower rule. Release a keep or change the input.'], selected: [], complete: false };
    place(r, ctx, 1);
  }
  const remaining = b.requests.filter(r => !b.pins.includes(r.id));
  const firstCome = [...kept], baseCtx = makeContext(b); kept.forEach(r => place(r, baseCtx, 1));
  for (const r of [...remaining].sort((a, z) => a.received.localeCompare(z.received) || a.id.localeCompare(z.id, 'en'))) if (canPlace(r, baseCtx)) { firstCome.push(r); place(r, baseCtx, 1); }
  let best = [...firstCome], nodes = 0, complete = true;
  const order = remaining.sort((a, z) => (dayNumber(a.end) - dayNumber(a.start)) - (dayNumber(z.end) - dayNumber(z.start)) || a.previousLoans - z.previousLoans || a.received.localeCompare(z.received) || a.id.localeCompare(z.id, 'en'));
  const picked = [...kept];
  function search(i) {
    if (nodes >= maxNodes) { complete = false; return; } nodes++;
    if (comparePlans(picked, best) > 0) best = [...picked];
    if (i === order.length) return;
    const possible = new Set(order.slice(i).filter(r => !ctx.borrowers.has(borrowerKey(r))).map(borrowerKey)).size;
    if (picked.length + possible < best.length) return;
    const r = order[i];
    if (canPlace(r, ctx)) { picked.push(r); place(r, ctx, 1); search(i + 1); place(r, ctx, -1); picked.pop(); }
    search(i + 1);
  }
  search(0);
  const selected = best.map(r => r.id).sort(), check = verifyPlan(b, selected);
  if (check.length) throw new Error('Internal plan validation failed: ' + check.join(' '));
  return { status: 'ready', selected, firstCome: firstCome.map(r => r.id).sort(), objective: objective(best), nodes, complete, errors: [] };
}
export function explain(b, result, id) {
  const r = b.requests.find(x => x.id === id);
  if (!r || result.status !== 'ready') return ['No valid plan is available.'];
  if (result.selected.includes(id)) return [b.pins.includes(id) ? 'Kept by you. Included in every plan until you release the keep.' : 'Selected under the displayed allocation rule. Equipment fits on every occupied date.'];
  const chosen = b.requests.filter(x => result.selected.includes(x.id));
  const other = chosen.find(x => borrowerKey(x) === borrowerKey(r));
  if (other) return [`Another request for ${r.borrower} is selected (${other.id}). This round allows one request per borrower.`];
  const ctx = makeContext(b); chosen.forEach(x => place(x, ctx, 1));
  const reasons = [];
  for (const [type, qty] of Object.entries(r.needs)) {
    const days = [];
    for (let d = dayNumber(r.start); d < dayNumber(r.end); d++) if (ctx.usage.get(type)[d - ctx.first] + qty > ctx.stock.get(type)) days.push(dateString(d));
    if (days.length) { const name = b.resources.find(x => x.id === type).name; const clashes = chosen.filter(x => x.needs[type] && days.some(d => d >= x.start && d < x.end)).map(x => x.id); reasons.push(`${name}: needs ${qty}; insufficient units on ${days.join(', ')}${clashes.length ? `. Shares those dates with ${clashes.join(', ')}` : '. Requested quantity exceeds the available stock'}.`); }
  }
  return reasons.length ? reasons : ['This request still fits. The search limit was reached before every combination was checked; keep this request to include it.'];
}
export function dailyUsage(b, selected) {
  const ctx = makeContext(b); b.requests.filter(r => selected.includes(r.id)).forEach(r => place(r, ctx, 1));
  return { dates: Array.from({ length: ctx.last - ctx.first }, (_, i) => dateString(ctx.first + i)), rows: b.resources.map(r => ({ ...r, usage: Array.from(ctx.usage.get(r.id)) })) };
}
