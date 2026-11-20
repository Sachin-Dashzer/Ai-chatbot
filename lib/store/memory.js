// In-memory store with the same interface as the MongoDB store.
// Used for tests and local development (STORE=memory). Data is lost on restart.

function match(doc, q) {
  for (const [k, cond] of Object.entries(q || {})) {
    const v = doc[k];
    if (cond !== null && typeof cond === "object" && !Array.isArray(cond)) {
      for (const [op, x] of Object.entries(cond)) {
        if (op === "$in" && !x.includes(v)) return false;
        if (op === "$nin" && x.includes(v)) return false;
        if (op === "$ne" && v === x) return false;
        if (op === "$gte" && !(v != null && v >= x)) return false;
        if (op === "$gt" && !(v != null && v > x)) return false;
        if (op === "$lte" && !(v != null && v <= x)) return false;
        if (op === "$lt" && !(v != null && v < x)) return false;
        if (op === "$exists" && (x ? v === undefined || v === null : !(v === undefined || v === null))) return false;
      }
    } else if ((v ?? null) !== (cond ?? null)) {
      return false;
    }
  }
  return true;
}


export class MemoryStore {
  constructor() {
    this.cols = {};
    this.counters = {};
  }

  _c(name) {
    return (this.cols[name] ||= []);
  }

  async nextId(name) {
    this.counters[name] = (this.counters[name] || 0) + 1;
    return this.counters[name];
  }

  async insert(name, doc) {
    const d = { ...doc };
    if (d.id === undefined) d.id = await this.nextId(name);
    this._c(name).push(d);
    return { ...d };
  }

  async find(name, q = {}, { sort, limit } = {}) {
    let rows = this._c(name).filter((d) => match(d, q)).map((d) => ({ ...d }));
    if (sort) {
      const keys = Object.entries(sort);
      rows.sort((a, b) => {
        for (const [k, dir] of keys) {
          const x = a[k] ?? "", y = b[k] ?? "";
          if (x < y) return -1 * dir;
          if (x > y) return 1 * dir;
        }
        return 0;
      });
    }
    if (limit) rows = rows.slice(0, limit);
    return rows;
  }

  async findOne(name, q) {
    const r = this._c(name).find((d) => match(d, q));
    return r ? { ...r } : null;
  }

  async count(name, q) {
    return this._c(name).filter((d) => match(d, q)).length;
  }

  async update(name, q, set) {
    let n = 0;
    for (const d of this._c(name)) if (match(d, q)) { Object.assign(d, set); n++; }
    return n;
  }

  async upsert(name, q, set) {
    const n = await this.update(name, q, set);
    if (!n) await this.insert(name, { ...q, ...set });
  }

  async remove(name, q) {
    const c = this._c(name);
    const keep = c.filter((d) => !match(d, q));
    this.cols[name] = keep;
    return c.length - keep.length;
  }
}
