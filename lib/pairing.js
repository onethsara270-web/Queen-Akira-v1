// Pairing code helper.
// Default: the library's own code (FIXOMODZ) — exactly like your other bots.
// Optional: set PAIRING_CODE (8 chars, 1-9 / A-Z without I, L, O, U) in env / config.json to use a custom code instead.
const config = require('../config');

function customCode() {
  const c = String(process.env.PAIRING_CODE || config.PAIRING_CODE || '').trim().toUpperCase();
  return /^[1-9A-HJKMNP-TV-Z]{8}$/.test(c) ? c : null;
}

async function requestValidPairingCode(conn, number) {
  const c = customCode();
  if (!c) return conn.requestPairingCode(number);       // default (FIXOMODZ) — untouched
  try { return await conn.requestPairingCode(number, c); }
  catch (e) { if (/custom/i.test(e.message)) return conn.requestPairingCode(number); throw e; }
}

module.exports = { requestValidPairingCode };
