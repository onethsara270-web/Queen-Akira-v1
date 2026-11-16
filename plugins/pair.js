// plugins/pair.js
// 🔗 Generate WhatsApp pairing code via chat command
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
  desc: "Generate a pairing code to connect a bot for a phone number",
  category: "system",
  react: "🔗",
  filename: __filename
}, async (conn, mek, m, { from, q, reply, senderNumber, isOwner }) => {
  if (!q) {
    return reply(
      `🔗 *PAIR CODE GENERATOR*\n\n` +
      `*Usage:* .pair <phone number>\n` +
      `*Example:* .pair 947XXXXXXXX\n\n` +
      `📌 The number must include the country code.\n` +
      `⚠️ You can only pair your own number (unless you're the owner).`
    );
  }

  const phone = String(q).replace(/[^0-9]/g, '');
  if (phone.length < 10 || phone.length > 15) {
    return reply(`❌ Invalid phone number.\nExample: 947XXXXXXXX`);
  }

  // Permission: owner can pair anyone, user can only pair their own number
  const canPair = isOwner || (senderNumber === phone);
  if (!canPair) {
    return reply(
      `❌ You can only pair your own number (*+${senderNumber}*).\n\n` +
      `If you need to pair a different number, ask the bot owner.`
    );
  }

  const userMgr = require('../user-manager');

  // Find or create user
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

  // Already connected
  if (existing && existing.status === 'active') {
    return reply(
      `✅ *Bot already connected*\n\n` +
      `📱 Number: *+${phone}*\n` +
      `🔑 Password: *${user.dashPassword}*\n\n` +
      `_Bot is running. No need to pair again._`
    );
  }

  // Pairing code already exists (still valid)
  if (existing && existing.status === 'pairing_code_ready' && existing.pairingCode) {
    const formatted = formatCode(existing.pairingCode);
    return reply(
      `🔗 *PAIRING CODE (ACTIVE)*\n\n` +
      `📱 Number: *+${phone}*\n` +
      `🔐 Code: *${formatted}*\n\n` +
      `*Steps:*\n` +
      `1. Open WhatsApp on +${phone}\n` +
      `2. Settings → Linked Devices\n` +
      `3. Link with phone number\n` +
      `4. Enter the code above\n\n` +
      `⏱️ Code expires in a few minutes.`
    );
  }

  // Stop existing instance if any
  if (existing) {
    try { userMgr.stopUserBot(user.sessionId); } catch (e) {}
    await new Promise(r => setTimeout(r, 800));
  }

  userMgr.LAST_ERRORS.delete(user.sessionId);

  await reply(
    `🔗 *PAIRING STARTED*\n\n` +
    `📱 Number: *+${phone}*\n` +
    `⏳ Generating code... (this may take up to 60s)`
  );

  // Start the bot with pairing code
  try {
    userMgr.createUserBot(user.sessionId, phone, global.ownerConn, { usePairingCode: true })
      .catch(e => console.error(`❌ [.pair] createUserBot error:`, e.stack || e.message));
  } catch (e) {
    return reply(`❌ Failed to start pairing: ${e.message}`);
  }

  // Poll for pairing code (up to 90s)
  const maxWait = 90000;
  const pollInterval = 2000;
  let waited = 0;

  while (waited < maxWait) {
    await new Promise(r => setTimeout(r, pollInterval));
    waited += pollInterval;

    const inst = userMgr.BOT_INSTANCES.get(user.sessionId);
    if (!inst) continue;

    if (inst.status === 'pairing_code_ready' && inst.pairingCode) {
      const formatted = formatCode(inst.pairingCode);
      await reply(
        `🔗 *PAIRING CODE READY* ✅\n\n` +
        `📱 Number: *+${phone}*\n` +
        `🔐 Code: *${formatted}*\n\n` +
        `*Steps to connect:*\n` +
        `1. Open WhatsApp on +${phone}\n` +
        `2. Go to *Settings → Linked Devices*\n` +
        `3. Tap *Link a Device*\n` +
        `4. Choose *Link with phone number*\n` +
        `5. Enter the code above\n\n` +
        `🔑 *Dashboard password:* \`${user.dashPassword}\`\n` +
        `🌐 *Login:* ${global.BOT_DOMAIN || 'your-server'}/login\n\n` +
        `⏱️ Code expires in ~5 minutes.`
      );
      return;
    }

    if (inst.status === 'active') {
      return reply(
        `✅ *Connected successfully!*\n\n` +
        `📱 Number: *+${phone}*\n` +
        `🔑 Password: *${user.dashPassword}*`
      );
    }

    if (inst.pairingCodeError && (inst.status === 'offline' || inst.status === 'stopped')) {
      return reply(
        `❌ *Pairing failed*\n\n` +
        `📱 Number: +${phone}\n` +
        `⚠️ ${inst.pairingCodeError}\n\n` +
        `Try again: *.pair ${phone}*`
      );
    }
  }

  // Timeout — check one more time
  const finalInst = userMgr.BOT_INSTANCES.get(user.sessionId);
  if (finalInst && finalInst.pairingCode) {
    const formatted = formatCode(finalInst.pairingCode);
    return reply(
      `🔗 *PAIRING CODE (late)*\n\n` +
      `📱 Number: *+${phone}*\n` +
      `🔐 Code: *${formatted}*\n\n` +
      `Enter in WhatsApp: Settings → Linked Devices → Link with phone number`
    );
  }

  return reply(
    `⏱️ *Timeout*\n\n` +
    `Code generation took too long.\n\n` +
    `Try:\n` +
    `1. Wait 30s, then *.pairstatus ${phone}*\n` +
    `2. Or retry: *.pair ${phone}*\n\n` +
    `WhatsApp servers may be busy — try again in a minute.`
  );
});

// ═══════════════════════════════════════════════════
//  🔍 STATUS CHECK
// ═══════════════════════════════════════════════════
cmd({
  pattern: "pairstatus",
  alias: ["pstatus", "pairinfo"],
  use: ".pairstatus <phone>",
  desc: "Check current pairing status for a phone number",
  category: "system",
  react: "🔍",
  filename: __filename
}, async (conn, mek, m, { from, q, reply, senderNumber, isOwner }) => {
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
  if (!inst) {
    return reply(
      `📊 *Status for +${phone}*\n\n` +
      `State: ⚪ Not running\n` +
      `🔑 Password: *${user.dashPassword}*\n\n` +
      `Use *.pair ${phone}* to start pairing.`
    );
  }

  const statusEmoji = {
    active: '🟢',
    pairing_code_ready: '🟡',
    connecting: '🔵',
    offline: '🔴',
    stopped: '⚫',
    qr_ready: '🟣'
  }[inst.status] || '❔';

  let text = `📊 *Status for +${phone}*\n\n`;
  text += `State: ${statusEmoji} *${inst.status}*\n`;
  text += `🔑 Password: *${user.dashPassword}*\n`;

  if (inst.pairingCode) {
    text += `🔐 Pairing Code: *${formatCode(inst.pairingCode)}*\n`;
  }
  if (inst.pairingCodeError) {
    text += `⚠️ Error: ${inst.pairingCodeError}\n`;
  }
  if (inst.connectedAt) {
    text += `✅ Connected: ${new Date(inst.connectedAt).toLocaleString()}\n`;
  }

  return reply(text);
});
