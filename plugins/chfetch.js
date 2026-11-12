// plugins/chfetch.js
const config = require('../config');
const { cmd } = require('../command');

cmd({
    pattern: "chfetch",
    alias: ["chhistory"],
    use: '.chfetch <channel_link_or_jid> [count]',
    desc: "Fetch recent messages from a channel",
    category: "channel",
    react: "📜",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('❌ *Usage:* .chfetch <channel_link> [count]');

    const parts = q.trim().split(' ');
    let jid = parts[0];
    let count = parseInt(parts[1]) || 10;
    let type = 'jid';
    let key = jid;

    if (jid.includes('whatsapp.com/channel/')) {
        type = 'invite';
        key = jid.split('channel/')[1].split('/')[0];
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        
        if (type === 'invite') {
            const meta = await conn.newsletterMetadata(type, key);
            jid = meta.id;
        }

        const messages = await conn.newsletterFetchMessages(jid, count);
        
        if (!messages || messages.length === 0) {
            return reply('❌ No messages found in this channel.');
        }

        let text = `📜 *Last ${messages.length} messages in channel:*\n\n`;
        messages.forEach((msg, i) => {
            const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '[Media]';
            text += `${i+1}. ${body.substring(0, 50)}${body.length > 50 ? '...' : ''}\n(ID: ${msg.serverId})\n\n`;
        });
        
        await reply(text);
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e) {
        await reply(`❌ *Failed to fetch messages:* ${e.message}`);
    }
});
