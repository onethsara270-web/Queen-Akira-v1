// plugins/chdelete.js
const config = require('../config');
const { cmd } = require('../command');

cmd({
    pattern: "chdelete",
    alias: ["channeldelete"],
    use: '.chdelete <channel_post_link>',
    desc: "Delete a message in a channel",
    category: "channel",
    react: "🗑️",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('❌ *Usage:* .chdelete <post_link>');
    
    const match = q.trim().match(/channel\/([a-zA-Z0-9]+)\/(\d+)/);
    if (!match) return reply('❌ *Invalid post link.*');

    const inviteCode = match[1];
    const serverId = match[2];

    try {
        const meta = await conn.newsletterMetadata('invite', inviteCode);
        if (!meta?.id) return reply('❌ Channel not found.');

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        
        await conn.newsletterRemoveMessage(meta.id, serverId);
        
        await reply(`✅ *Post deleted successfully!*`);
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e) {
        await reply(`❌ *Failed to delete:* ${e.message}`);
    }
});
