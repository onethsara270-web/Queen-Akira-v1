// plugins/chreact.js
const config = require('../config');
const { cmd } = require('../command');

cmd({
    pattern: "chreact",
    alias: ["channelreact"],
    use: '.chreact <channel_post_link> <emoji>',
    desc: "React to a channel post",
    category: "channel",
    react: "❤️",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    // Example link: https://whatsapp.com/channel/0029VaXXXXX/12345
    if (!q) return reply('❌ *Usage:* .chreact <post_link> <emoji>');
    
    const parts = q.split(' ');
    const link = parts[0];
    const emoji = parts[1] || '❤️';

    const match = link.match(/channel\/([a-zA-Z0-9]+)\/(\d+)/);
    if (!match) return reply('❌ *Invalid post link.* Must be a link to a specific post.');

    const inviteCode = match[1];
    const serverId = match[2];

    try {
        const meta = await conn.newsletterMetadata('invite', inviteCode);
        if (!meta?.id) return reply('❌ Channel not found.');

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        
        await conn.newsletterReactMessage(meta.id, serverId, emoji);
        
        await reply(`✅ *Reacted with ${emoji} to the post!*`);
        await conn.sendMessage(from, { react: { text: emoji, key: mek.key } });
    } catch (e) {
        await reply(`❌ *Failed to react:* ${e.message}`);
    }
});
