// plugins/presencediag.js
const { cmd } = require('../command');

function isTrue(v) {
  if (v === true) return true;
  return String(v).toLowerCase() === 'true';
}

cmd({
  pattern: "presencediag",
  alias: ["pdiag", "presencetest", "typingtest"],
  desc: "Diagnose auto-typing/recording",
  category: "system",
  react: "🔍",
  filename: __filename
}, async (conn, mek, m, { from, reply, botConfig }) => {
  const cfg = botConfig || conn._userConfig || {};

  let text = `*🔍 PRESENCE DIAGNOSTIC*\n\n`;
  text += `*Config Values:*\n`;
  text += `• AUTO_TYPING: \`${cfg.AUTO_TYPING}\` (${isTrue(cfg.AUTO_TYPING) ? 'ON' : 'OFF'})\n`;
  text += `• AUTO_RECORDING: \`${cfg.AUTO_RECORDING}\` (${isTrue(cfg.AUTO_RECORDING) ? 'ON' : 'OFF'})\n`;
  text += `• ALWAYS_ONLINE: \`${cfg.ALWAYS_ONLINE}\`\n\n`;
  text += `*Connection:*\n`;
  text += `• Connected: \`${!!conn.user}\`\n`;
  text += `• Bot JID: \`${conn.user?.id || 'none'}\`\n`;
  text += `• Target JID: \`${from}\`\n\n`;

  try {
    if (typeof conn.presenceSubscribe === 'function') {
      await Promise.race([
        conn.presenceSubscribe(from),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout 2s')), 2000))
      ]);
      text += `✅ presenceSubscribe: OK\n`;
    } else {
      text += `⚠️ presenceSubscribe: not available\n`;
    }
  } catch (e) {
    text += `❌ presenceSubscribe: ${e.message}\n`;
  }

  try {
    await Promise.race([
      conn.sendPresenceUpdate('available', from),
      new Promise((_, r) => setTimeout(() => r(new Error('timeout 3s')), 3000))
    ]);
    text += `✅ sendPresenceUpdate('available'): OK\n`;
  } catch (e) {
    text += `❌ available: ${e.message}\n`;
  }

  await reply(text);

  await new Promise(r => setTimeout(r, 500));
  try {
    await Promise.race([
      conn.sendPresenceUpdate('composing', from),
      new Promise((_, r) => setTimeout(() => r(new Error('timeout 3s')), 3000))
    ]);
    await reply(`✅ *composing sent*\n\n👉 Look at this chat on ANOTHER phone. Should show "typing..."`);

    await new Promise(r => setTimeout(r, 5000));
    await conn.sendPresenceUpdate('paused', from).catch(() => {});
    await reply(`✅ *paused sent* — Typing indicator should disappear`);
  } catch (e) {
    await reply(`❌ composing: ${e.message}`);
  }
});
