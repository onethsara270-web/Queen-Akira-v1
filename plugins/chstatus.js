// plugins/chstatus.js
const { downloadContentFromMessage } = require('fixo-baileys');
const config = require('../config');
const { cmd } = require('../command');

cmd({
    pattern: "chstatus",
    alias: ["channelstatus"],
    use: '.chstatus <link/jid> <text> (or reply to media)',
    desc: "Post a WhatsApp Channel Status",
    category: "channel",
    react: "📢",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('❌ *Usage:* .chstatus <link/jid> <text> or reply to media');
    
    const parts = q.split(' ');
    const target = parts.shift();
    let text = parts.join(' ');

    let jid = target;
    if (target.includes('whatsapp.com/channel/')) {
        const code = target.split('channel/')[1].split('/')[0];
        try {
            const meta = await conn.newsletterMetadata('invite', code);
            jid = meta.id;
        } catch { return reply('❌ Invalid channel link.'); }
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        // Permission check
        const { canPost } = await conn.newsletterCanPostStatus(jid);
        if (!canPost) return reply('❌ *Bot is not an Admin in this channel.* Make the bot admin first!');

        let content = null;
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (quoted?.imageMessage) {
            const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
            const chunks = []; for await (const c of stream) chunks.push(c);
            content = { image: Buffer.concat(chunks), caption: text || '' };
        } else if (quoted?.videoMessage) {
            const stream = await downloadContentFromMessage(quoted.videoMessage, 'video');
            const chunks = []; for await (const c of stream) chunks.push(c);
            content = { video: Buffer.concat(chunks), caption: text || '' };
        } else if (text) {
            content = { text: text, backgroundColor: '#FFC107', font: 2 }; // Yellow bg
        }

        if (!content) return reply('❌ Give text or reply to an image/video.');

        await conn.sendChannelStatus(jid, content);
        
        await reply(`✅ *Status posted to channel!*`);
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (e) {
        await reply(`❌ *Error:* ${e.message}`);
    }
});
