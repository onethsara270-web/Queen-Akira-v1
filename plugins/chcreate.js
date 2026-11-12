// plugins/chcreate.js
const config = require('../config');
const { cmd } = require('../command');

cmd({
    pattern: "chcreate",
    alias: ["createchannel", "newchannel"],
    use: '.chcreate <Name> | <Description>',
    desc: "Create a new WhatsApp Channel",
    category: "channel",
    react: "➕",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('❌ *Usage:* .chcreate My Channel | My Description');
    
    const [name, desc] = q.split('|').map(s => s.trim());
    if (!name) return reply('❌ *Channel Name is required.*');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        
        // Library call
        const res = await conn.newsletterCreate(name, desc || '');
        
        await reply(`✅ *Channel Created Successfully!*\n\n📌 *Name:* ${name}\n🆔 *JID:* ${res.jid}\n🔗 *Link:* https://whatsapp.com/channel/${res.inviteCode || ''}`);
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e) {
        console.error(e);
        await reply(`❌ *Failed to create channel:*\n_${e.message}_`);
    }
});
