// plugins/chupdate.js
const { downloadContentFromMessage } = require('fixo-baileys');
const config = require('../config');
const { cmd } = require('../command');

cmd({
    pattern: "chupdate",
    alias: ["updatechannel"],
    use: '.chupdate <link/jid> <Name> | <Description> (Reply to image for DP)',
    desc: "Update channel name, description or profile picture",
    category: "channel",
    react: "✏️",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('❌ *Usage:* .chupdate <link/jid> <New Name> | <New Description>');
    
    const parts = q.split(' ');
    const target = parts.shift();
    const rest = parts.join(' ');
    
    // Extract JID (Simple version, assuming user sends JID or link)
    let jid = target;
    if (target.includes('whatsapp.com/channel/')) {
        const code = target.split('channel/')[1].split('/')[0];
        try {
            const meta = await conn.newsletterMetadata('invite', code);
            jid = meta.id;
        } catch { return reply('❌ Invalid channel link.'); }
    }

    const [name, desc] = rest.split('|').map(s => s.trim());
    let pictureBuffer = null;

    // Check for replied image (Profile Picture update)
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    if (quoted) {
        const stream = await downloadContentFromMessage(quoted, 'image');
        const chunks = [];
        for await (const c of stream) chunks.push(c);
        pictureBuffer = Buffer.concat(chunks);
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        
        await conn.newsletterUpdate(jid, {
            name: name || undefined,
            description: desc || undefined,
            pictureBuffer: pictureBuffer
        });
        
        await reply(`✅ *Channel Updated Successfully!*\n📌 JID: ${jid}`);
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e) {
        await reply(`❌ *Failed to update:*\n_${e.message}_`);
    }
});
