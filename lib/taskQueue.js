// ============================================================
// 🧵 TASK QUEUE — simple in-memory async job queue
// Path: lib/taskQueue.js
//
// Used by the Automation Dashboard (routes/automation.js) to run a
// dashboard-submitted action (react / poll / follow) asynchronously
// against ONE connected session the caller owns, instead of blocking
// the HTTP request on a WhatsApp round-trip.
//
// Not a distributed/clustered queue (no Redis) — a single Node
// process worker loop is enough for one bot server. Swap this file
// for a BullMQ-backed one later without touching the routes, since
// the public shape (enqueue/list/get) stays the same.
// ============================================================

const crypto = require('crypto');

const MAX_HISTORY = 200;

class TaskQueue {
  constructor() {
    this.handlers = new Map();   // type -> async (payload) => result
    this.jobs = new Map();       // id -> job
    this.order = [];             // ids, oldest first (for trimming)
    this.pending = [];           // ids waiting to run
    this.running = false;
  }

  /** Register the async function that actually performs a task type. */
  registerHandler(type, fn) {
    this.handlers.set(type, fn);
  }

  /** Queue a job. Returns the job record immediately (status: 'pending'). */
  enqueue(type, payload = {}) {
    if (!this.handlers.has(type)) {
      throw new Error(`No handler registered for task type "${type}"`);
    }
    const id = crypto.randomBytes(8).toString('hex');
    const job = {
      id, type, payload,
      status: 'pending',          // pending -> running -> done | failed
      result: null, error: null,
      createdAt: new Date().toISOString(),
      startedAt: null, finishedAt: null
    };
    this.jobs.set(id, job);
    this.order.push(id);
    this._trim();
    this.pending.push(id);
    this._drain();
    return job;
  }

  get(id) { return this.jobs.get(id) || null; }

  /** Most recent jobs first, optionally filtered by sessionId. */
  list({ sessionId, limit = 50 } = {}) {
    let ids = [...this.order].reverse();
    if (sessionId) ids = ids.filter(id => this.jobs.get(id)?.payload?.sessionId === sessionId);
    return ids.slice(0, limit).map(id => this.jobs.get(id));
  }

  _trim() {
    while (this.order.length > MAX_HISTORY) {
      const id = this.order.shift();
      this.jobs.delete(id);
    }
  }

  async _drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending.length) {
        const id = this.pending.shift();
        const job = this.jobs.get(id);
        if (!job) continue;
        job.status = 'running';
        job.startedAt = new Date().toISOString();
        try {
          const fn = this.handlers.get(job.type);
          job.result = await fn(job.payload);
          job.status = 'done';
        } catch (e) {
          job.status = 'failed';
          job.error = e.message || String(e);
        }
        job.finishedAt = new Date().toISOString();
      }
    } finally {
      this.running = false;
    }
  }
}

module.exports = new TaskQueue();
