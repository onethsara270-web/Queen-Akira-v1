// ============================================================
// 🔐 AUTH SYNC — keeps the WHOLE session folder in MongoDB
// (creds.json + signal sessions + pre-keys + app-state keys)
// so a redeploy / restart on hosts with a temporary disk (Render, Heroku…)
// does not lose the session. Only REGISTERED (really linked) sessions are saved.
// ============================================================
const fs = require('fs');
const path = require('path');

function mongo() { try { return require('./mongo'); } catch (e) { return null; } }

function isRegistered(dir) {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(dir, 'creds.json'), 'utf8'));
    return !!(c && c.registered && c.me);
  } catch (e) { return false; }
}

/** Write every stored file of this session into dir. Returns the number of files restored. */
async function restore(sessionId, dir) {
  const m = mongo();
  if (!m || !m.isConnected()) return 0;
  const files = await m.getAuthFiles(sessionId);
  if (!files.length) return 0;
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  for (const f of files) {
    try { fs.writeFileSync(path.join(dir, path.basename(f.name)), f.data, 'utf8'); n++; } catch (e) {}
  }
  return n;
}

/** Periodically upload changed files. Returns { flush, stop }. */
function start(sessionId, dir, intervalMs = 45000) {
  const known = new Map();           // file name -> "mtime:size"
  let running = false;

  async function flush() {
    const m = mongo();
    if (running || !m || !m.isConnected() || !isRegistered(dir)) return;
    running = true;
    try {
      for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.json')) continue;
        const full = path.join(dir, name);
        let st; try { st = fs.statSync(full); } catch (e) { continue; }
        const sig = st.mtimeMs + ':' + st.size;
        if (known.get(name) === sig) continue;
        const ok = await m.saveAuthFile(sessionId, name, fs.readFileSync(full, 'utf8'));
        if (ok) known.set(name, sig);
      }
    } catch (e) { /* folder may be gone (session deleted) */ }
    running = false;
  }

  const timer = setInterval(flush, intervalMs);
  if (timer.unref) timer.unref();
  return { flush, stop: () => clearInterval(timer) };
}

async function remove(sessionId) {
  const m = mongo();
  if (m && m.isConnected()) await m.deleteAuthFiles(sessionId);
}

module.exports = { isRegistered, restore, start, remove };
