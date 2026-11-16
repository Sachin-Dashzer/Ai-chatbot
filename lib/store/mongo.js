// MongoDB store. Same interface as MemoryStore.
// Every document has a numeric `id` (from a counters collection) so tasks read as #12, #13 ...
import { MongoClient } from "mongodb";

export class MongoStore {
  constructor(uri, dbName) {
    this.client = new MongoClient(uri);
    this.dbName = dbName;
    this.ready = this.client.connect().then(async () => {
      this.db = this.client.db(dbName);
      await this.db.collection("tasks").createIndex({ id: 1 }, { unique: true });
      await this.db.collection("tasks").createIndex({ status: 1, owner: 1, business: 1 });
      await this.db.collection("messages").createIndex({ person: 1, id: -1 });
      await this.db.collection("messages_out").createIndex({ person: 1, id: -1 });
      await this.db.collection("task_notes").createIndex({ task_id: 1 });
      await this.db.collection("seen_messages").createIndex({ mid: 1 }, { unique: true });
      // Lets /api/cron claim a slot atomically: a second, parallel claim fails instead of re-sending.
      await this.db.collection("job_runs").createIndex({ date: 1, key: 1 }, { unique: true });
    });
  }

  async col(name) {
    await this.ready;
    return this.db.collection(name);
  }

  async nextId(name) {
    const c = await this.col("counters");
    const r = await c.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
    return (r.value ?? r).seq;
  }

  _clean(d) {
    if (!d) return d;
    const { _id, ...rest } = d;
    return rest;
  }

  async insert(name, doc) {
    const d = { ...doc };
    if (d.id === undefined) d.id = await this.nextId(name);
    await (await this.col(name)).insertOne(d);
    return this._clean(d);
  }

  async find(name, q = {}, { sort, limit } = {}) {
    let cur = (await this.col(name)).find(q);
    if (sort) cur = cur.sort(sort);
    if (limit) cur = cur.limit(limit);
    return (await cur.toArray()).map((d) => this._clean(d));
  }

  async findOne(name, q) {
    return this._clean(await (await this.col(name)).findOne(q));
  }

  async count(name, q) {
    return (await this.col(name)).countDocuments(q);
  }

  async update(name, q, set) {
    return (await (await this.col(name)).updateMany(q, { $set: set })).modifiedCount;
  }

  async upsert(name, q, set) {
    const c = await this.col(name);
    const found = await c.findOne(q);
    if (found) await c.updateMany(q, { $set: set });
    else await this.insert(name, { ...q, ...set });
  }

  async remove(name, q) {
    return (await (await this.col(name)).deleteMany(q)).deletedCount;
  }
}
