// plugins/pair.js
// 🔗 Pair code generator — works in DMs AND groups (DM only for privacy)
const { cmd } = require('../command');

function formatCode(code) {
  if (!code) return '--------';
  const clean = String(code).replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (clean.length === 8) return clean.slice(0, 4) + '-' + clean.slice(4);
  return clean;
}

cmd({
  pattern: "pair",
  alias: ["paircode", "connect"],
  use: ".pair <phone>",
  desc: "Generate pairing code (works in groups — code sent to DM)",
  category: "system",
  react: "🔗",
  filename: __filename
}, async (conn, mek, m, { from, q, reply, sender, senderNumber, isOwner, isGroup }) => {
  // ── Helpers ──
  const inGroup = isGroup || from.endsWith('@g.us');
  const targetDm = (ph) => String(ph).replace(/[^0-9]/g, '') + '@s.whatsapp.net';

  if (!q) {
    return reply(
      `🔗 *PAIR CODE GENERATOR*\n\n` +
      `*Usage:* .pair <phone number>\n` +
      `*Example:* .pair 947XXXXXXXX\n\n` +
      `📌 Include country code (no + or spaces)\n` +
      `📩 *Works in groups too* — pair code is DM'd to you (not shown in group).`
    );
  }

  const phone = String(q).replace(/[^0-9]/g, '');
  if (phone.length < 10 || phone.length > 15) {
    return reply(`❌ Invalid phone number.\nExample: 947XXXXXXXX`);
  }

  // Permission: owner = any number, user = own number only
  const canPair = isOwner || (senderNumber === phone);
  if (!canPair) {
    return reply(`❌ You can only pair your own number (*+${senderNumber}*).`);
  }

  const userMgr = require('../user-manager');

  // ── PairReply helper: sends full details to DM, ack in group ──
  async function pairReply(text) {
    if (inGroup) {
      // In group: send full details to DM (privacy)
      try {
        await conn.sendMessage(targetDm(phone), { text });
        if (isOwner) {
          // Owner also sees full details in group
          await reply(text);
        } else {
          await reply(
            `📩 *Pair details sent to +${phone}*\n\n` +
            `_Open WhatsApp → chat with this bot on +${phone} to see the code._`
          );
        }
      } catch (e) {
        // DM failed — fallback to group
        console.log(`⚠️ [.pair] DM failed to ${phone}:`, e.message);
        await reply(`⚠️ *Could not DM +${phone}*\n\n*Fallback — full details:*\n\n${text}`);
      }
    } else {
      // DM: reply directly
      await reply(text);
    }
  }

  // ── Find or create user ──
  let user = userMgr.USERS[phone];
  if (!user) {
    user = {
      phone: phone,
      name: 'User ' + phone.slice(-4),
      createdAt: new Date().toISOString(),
      sessionId: userMgr.generateSessionId(),
      dashPassword: userMgr.generateUnique5Digit(),
      status: 'pending',
      token: null,
      deployedAt: new Date().toISOString()
    };
    await userMgr.persistUser(user);
    console.log(`🎉 [.pair] Created user: ${phone} (pw: ${user.dashPassword})`);
  }

  const existing = userMgr.BOT_INSTANCES.get(user.sessionId);

  // ── Already connected ──
  if (existing && existing.status === 'active') {
    return pairReply(
      `✅ *Bot already connected*\n\n` +
      `📱 Number: *+${phone}*\n` +
      `🔑 Password: *${user.dashPassword}*`
    );
  }

  // ── Existing pair code still valid ──
  if (existing && existing.status === 'pairing_code_ready' && existing.pairingCode) {
    return pairReply(
      `🔗 *PAIRING CODE (ACTIVE)*\n\n` +
      `📱 Number: *+${phone}*\n` +
      `🔐 Code: *${formatCode(existing.pairingCode)}*\n\n` +
      `*Steps:*\n` +
      `1. WhatsApp → Settings\n` +
      `2. Linked Devices → Link with phone number\n` +
      `3. Enter code above`
    );
  }

  // ── Stop existing instance ──
  if (existing) {
    try { userMgr.stopUserBot(user.sessionId); } catch (e) {}
    await new Promise(r => setTimeout(r, 800));
  }

  userMgr.LAST_ERRORS.delete(user.sessionId);

  // ── Initial message (brief ack in group, full in DM) ──
  if (inGroup && !isOwner) {
    await reply(`🔗 Pairing +${phone}...\n📩 Code will be sent to your DM.`);
  } else {
    await reply(
      `🔗 *PAIRING STARTED*\n\n` +
      `📱 *+${phone}*\n` +
      `⏳ Generating code... (up to 60s)`
    );
  }

  // ── Start pairing ──
  try {
    userMgr.createUserBot(user.sessionId, phone, global.ownerConn, { usePairingCode: true })
      .catch(e => console.error(`❌ [.pair] createUserBot error:`, e.stack || e.message));
  } catch (e) {
    return pairReply(`❌ Failed to start pairing: ${e.message}`);
  }

  // ── Poll for result (up to 90s) ──
  const maxWait = 90000;
  const pollInterval = 2000;
  let waited = 0;

  while (waited < maxWait) {
    await new Promise(r => setTimeout(r, pollInterval));
    waited += pollInterval;

    const inst = userMgr.BOT_INSTANCES.get(user.sessionId);
    if (!inst) continue;

    if (inst.status === 'pairing_code_ready' && inst.pairingCode) {
      // ✅ FIXED: මෙතන domain එක https://queen-zara.cc.cd ලෙස වෙනස් කළා
      return pairReply(
        `🔗 *PAIRING CODE READY* ✅\n\n` +
        `📱 Number: *+${phone}*\n` +
        `🔐 Code: *${formatCode(inst.pairingCode)}*\n\n` +
        `*Steps:*\n` +
        `1. WhatsApp → Settings\n` +
        `2. Linked Devices → Link a Device\n` +
        `3. Link with phone number\n` +
        `4. Enter: *${formatCode(inst.pairingCode)}*\n\n` +
        `🔑 *Password:* \`${user.dashPassword}\`\n` +
        `🌐 *Login:* https://queen-zara.cc.cd/login`
      );
    }

    if (inst.status === 'active') {
      return pairReply(
        `✅ *Connected successfully!*\n\n` +
        `📱 Number: *+${phone}*\n` +
        `🔑 Password: *${user.dashPassword}*`
      );
    }

    if (inst.pairingCodeError && (inst.status === 'offline' || inst.status === 'stopped')) {
      return pairReply(
        `❌ *Pairing failed*\n\n` +
        `📱 +${phone}\n` +
        `⚠️ ${inst.pairingCodeError}\n\n` +
        `Try again: *.pair ${phone}*`
      );
    }
  }

  // ── Timeout — check once more ──
  const finalInst = userMgr.BOT_INSTANCES.get(user.sessionId);
  if (finalInst && finalInst.pairingCode) {
    return pairReply(
      `🔗 *PAIRING CODE (late)*\n\n` +
      `📱 *+${phone}*\n` +
      `🔐 *${formatCode(finalInst.pairingCode)}*\n\n` +
      `Settings → Linked Devices → Link with phone number`
    );
  }

  return pairReply(
    `⏱️ *Timeout*\n\n` +
    `Code generation took too long.\n\n` +
    `Try:\n` +
    `• *.pairstatus ${phone}*\n` +
    `• *.pair ${phone}* (retry)`
  );
});

// ═══════════════════════════════════════════════════
//  🔍 STATUS CHECK (also group-friendly)
// ═══════════════════════════════════════════════════
cmd({
  pattern: "pairstatus",
  alias: ["pstatus", "pairinfo"],
  use: ".pairstatus <phone>",
  desc: "Check current pairing status (DM'd in groups)",
  category: "system",
  react: "🔍",
  filename: __filename
}, async (conn, mek, m, { from, q, reply, senderNumber, isOwner, isGroup }) => {
  if (!q) return reply(`Usage: .pairstatus <phone>`);
  const phone = String(q).replace(/[^0-9]/g, '');
  if (phone.length < 10) return reply(`❌ Invalid phone number`);

  if (!isOwner && senderNumber !== phone) {
    return reply(`❌ You can only check your own number.`);
  }

  const userMgr = require('../user-manager');
  const user = userMgr.USERS[phone];
  if (!user) return reply(`❌ No user found for +${phone}`);

  const inst = userMgr.BOT_INSTANCES.get(user.sessionId);
  const inGroup = isGroup || from.endsWith('@g.us');
  const targetDm = phone + '@s.whatsapp.net';

  let text;
  if (!inst) {
    text =
      `📊 *Status: +${phone}*\n\n` +
      `⚪ Not running\n` +
      `🔑 Password: *${user.dashPassword}*\n\n` +
      `Use *.pair ${phone}* to start.`;
  } else {
    const statusEmoji = {
      active: '🟢',
      pairing_code_ready: '🟡',
      connecting: '🔵',
      offline: '🔴',
      stopped: '⚫',
      qr_ready: '🟣'
    }[inst.status] || '❔';

    text =
      `📊 *Status: +${phone}*\n\n` +
      `State: ${statusEmoji} *${inst.status}*\n` +
      `🔑 Password: *${user.dashPassword}*\n`;
    if (inst.pairingCode) text += `🔐 Code: *${formatCode(inst.pairingCode)}*\n`;
    if (inst.pairingCodeError) text += `⚠️ ${inst.pairingCodeError}\n`;
    if (inst.connectedAt) text += `✅ Connected: ${new Date(inst.connectedAt).toLocaleString()}\n`;
  }

  // Group + non-owner: send full status to DM
  if (inGroup && !isOwner) {
    try {
      await conn.sendMessage(targetDm, { text });
      return reply(`📩 *Status sent to +${phone} DM*`);
    } catch (e) {
      return reply(`⚠️ Could not DM +${phone}\n\n*Fallback:*\n\n${text}`);
    }
  }

  return reply(text);
});
