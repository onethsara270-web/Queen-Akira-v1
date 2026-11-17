// plugins/joindiag.js
const { cmd } = require('../command');

cmd({
  pattern: "joindiag",
  alias: ["jdiag", "testjoin", "joinchannel"],
  desc: "Diagnose forced channel join",
  category: "system",
  react: "📢",
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  const code = '0029Vb8c75l1SWstC9vY7c37';

  let text = `*📢 CHANNEL JOIN DIAGNOSTIC*\n\n`;
  text += `*Channel code:* \`${code}\`\n\n`;

  let jid = null;
  try {
    if (typeof conn.newsletterMetadata === 'function') {
      const meta = await Promise.race([
        conn.newsletterMetadata('invite', code),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout 10s')), 10000))
      ]);
      jid = meta?.id;
      text += `✅ newsletterMetadata: OK\n`;
      text += `• JID: \`${jid}\`\n`;
      text += `• Name: \`${meta?.name || 'unknown'}\`\n`;
    } else {
      text += `❌ newsletterMetadata: not available\n`;
    }
  } catch (e) {
    text += `❌ newsletterMetadata: ${e.message}\n`;
  }

  if (!jid) {
    return reply(text + `\n*Cannot proceed — JID missing*`);
  }

  try {
    if (typeof conn.newsletterFollow === 'function') {
      await Promise.race([
        conn.newsletterFollow(jid),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout 15s')), 15000))
      ]);
      text += `✅ newsletterFollow: OK\n`;
    } else {
      text += `❌ newsletterFollow: not available\n`;
    }
  } catch (e) {
    const already = /already|following/i.test(e.message);
    text += already ? `✅ Already following\n` : `❌ newsletterFollow: ${e.message}\n`;
  }

  await reply(text);
});
