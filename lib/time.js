const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");

export function parts(date, tz) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    y: +p.year, m: +p.month, d: +p.day, H: +p.hour, M: +p.minute, S: +p.second,
    weekday: p.weekday.toLowerCase().slice(0, 3),
  };
}

export function isoLocal(date, tz) {
  const p = parts(date, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.H, p.M, p.S);
  const off = Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  const sign = off >= 0 ? "+" : "-";
  const a = Math.abs(off);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.H)}:${pad(p.M)}:${pad(p.S)}${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

export const localDate = (date, tz) => isoLocal(date, tz).slice(0, 10);

// "2026-11-16" + n days -> "2026-11-17"
export function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function daysBetween(ymdFrom, ymdTo) {
  const a = Date.UTC(...ymdFrom.split("-").map((x, i) => (i === 1 ? x - 1 : +x)));
  const b = Date.UTC(...ymdTo.split("-").map((x, i) => (i === 1 ? x - 1 : +x)));
  return Math.round((b - a) / 86400000);
}

export function weekdayOf(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

// "mon-sat" / "mon,thu" -> the set of weekday codes it names. The same spec the
// scheduler turns into cron days, read here as plain weekdays.
export function workDaySet(spec) {
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const set = new Set();
  for (const part of String(spec).toLowerCase().split(",")) {
    const [a, b] = part.trim().split("-").map((d) => order.indexOf(d.slice(0, 3)));
    if (a < 0) continue;
    if (b == null || b < 0) set.add(order[a]);
    else for (let i = a, n = (b - a + 7) % 7; n >= 0; n--, i = (i + 1) % 7) set.add(order[i]);
  }
  return set;
}

// Formatting from a stored ISO string (keeps its own local time, no conversion)
const P = (iso) => ({ y: +iso.slice(0, 4), m: +iso.slice(5, 7), d: +iso.slice(8, 10), H: +iso.slice(11, 13), M: +iso.slice(14, 16) });
export const fmtDayMon = (iso) => { const p = P(iso); return `${p.d} ${MONTHS[p.m - 1]}`; };
export const fmtWeekday = (iso) => {
  const w = weekdayOf(iso.slice(0, 10));
  return `${w[0].toUpperCase()}${w.slice(1)} ${pad(P(iso).d)} ${MONTHS[P(iso).m - 1]}`;
};
export const fmtTime = (iso) => {
  const p = P(iso);
  const h = p.H % 12 || 12;
  return `${pad(h)}:${pad(p.M)} ${p.H < 12 ? "AM" : "PM"}`;
};
export const fmtStamp = (iso) => `${fmtDayMon(iso)} ${fmtTime(iso)}`;
export { MONTHS, WEEKDAYS };
