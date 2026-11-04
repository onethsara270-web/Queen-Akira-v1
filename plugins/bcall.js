// plugins/broadcast.js
const config = require('../config');
const { cmd } = require('../command');

// ── Branding ──────────────────────────────
const BOT_NAME = "Queen Zara";
// ──────────────────────────────────────────

cmd({
    pattern: "broadcast",
    alias: ["bc", "broadcastmsg"],
    use: '.broadcast <message>',
    desc: "Send a message to all chats & groups (owner only)",
    category: "owner",
    react: "📣",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isCreator, isOwner, sender }) => {

    // ── Owner check ──────────────────────────
    if (!isCreator && !isOwner) {
        return reply('❌ *Owner only!*\n\nThis command is restricted to the bot owner.');
    }

    // ── Message check ────────────────────────
    const broadcastMessage = (q || '').trim();
    if (!broadcastMessage) {
        return reply(
            `📣 *Broadcast Command*\n\n` +
            `*Usage:* .broadcast [message]\n\n` +
            `*Example:*\n` +
            `.broadcast Hello everyone! This is a broadcast message.\n\n` +
            `⚠️ *Note:* Message will be sent to all chats and groups.`
        );
    }

    try {
        // ── Get all chats ────────────────────
        const chatStore = conn.chats || conn.store?.chats || {};
        const allChats  = Object.keys(chatStore).filter(jid =>
            jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us')
        );

        if (allChats.length === 0) {
            return reply('❌ *No chats found!*\n\nPlease make sure the bot has chats to broadcast to.');
        }

        const preview = broadcastMessage.length > 50
            ? broadcastMessage.substring(0, 50) + '...'
            : broadcastMessage;

        // ── Start notice ─────────────────────
        await reply(
            `📣 *Broadcasting...*\n\n` +
            `📌 *Message:* ${preview}\n` +
            `📊 *Total Chats:* ${allChats.length}\n` +
            `⏳ *Status:* Sending...`
        );

        let sent = 0;
        let failed = 0;

        for (const jid of allChats) {
            try {
                await conn.sendMessage(jid, {
                    text:
                        `📣 *BROADCAST MESSAGE* 📣\n\n` +
                        `${broadcastMessage}\n\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                        `⚡ Powered by ${BOT_NAME}`
                });
                sent++;
                // rate-limit එකට 500ms delay
                await new Promise(r => setTimeout(r, 500));
            } catch (e) {
                failed++;
                console.error(`[broadcast] failed → ${jid}:`, e.message);
            }
        }

        // ── Completion report ────────────────
        await reply(
            `✅ *Broadcast Complete*\n\n` +
            `📌 *Message:* ${preview}\n` +
            `✅ *Sent:* ${sent}\n` +
            `❌ *Failed:* ${failed}\n` +
            `📊 *Total:* ${allChats.length}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `⚡ Powered by ${BOT_NAME}`
        );

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (error) {
        console.error('[broadcast]', error);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error:* ${error.message}`);
    }
});