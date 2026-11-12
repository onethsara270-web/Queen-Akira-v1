// plugins/chinfo.js
const config = require('../config');
const { cmd } = require('../command');

cmd({
    pattern: "chinfo",
    alias: ["channelinfo"],
    use: '.chinfo <channel_link_or_jid>',
    desc: "Get WhatsApp Channel Metadata",
    category: "channel",
    react: "ℹ️",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('❌ *Usage:* .chinfo <channel_link>');

    let jid = q.trim();
    let type = 'jid';
    let key = jid;

    if (jid.includes('whatsapp.com/channel/')) {
        type = 'invite';
        key = jid.split('channel/')[1].split('/')[0];
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const meta = await conn.newsletterMetadata(type, key);
        
        const text = `📢 *CHANNEL INFO*\n\n` +
                     `📌 *Name:* ${meta.name}\n` +
                     `🆔 *JID:* ${meta.id}\n` +
                     `👥 *Subscribers:* ${meta.subscribers}\n` +
                     `✅ *Verified:* ${meta.verified ? 'Yes' : 'No'}\n` +
                     `👑 *Role:* ${meta.role || 'None'}`;
                     
        await reply(text);
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e) {
        await reply(`❌ *Failed to fetch info:* ${e.message}`);
    }
});
