const axios = require('axios');
const { cmd } = require('../command');

cmd({
    pattern: "fakechat",
    alias: ["fc", "fakechatgen"],
    use: '.fakechat <text>',
    desc: "Generate a fake WhatsApp chat image",
    category: "tools",
    react: "📱",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('📱 *Fake Chat Generator*\n\nUsage:\n.fakechat Hello, how are you?');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        // ඔයාගේ නම (චැට් එකේ එවන කෙනාගේ නම)
        const senderName = m.pushName || 'User';
        
        const apiUrl = `https://api.qasimdev.dpdns.org/api/fakechat?apikey=qasim-dev&text=${encodeURIComponent(q)}&sender=${encodeURIComponent(senderName)}`;
        
        const { data } = await axios.get(apiUrl, { timeout: 20000 });

        if (!data || !data.result) throw new Error('Invalid API response');

        await conn.sendMessage(from, { 
            image: { url: data.result }, 
            caption: '📱 *Fake Chat Generated*' 
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
    } catch (error) {
        console.error('FakeChat Error:', error.message);
        reply('❌ *Failed to generate fake chat.*');
    }
});
