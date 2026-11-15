const axios = require('axios');
const { cmd } = require('../command');

// AI API fallbacks
const AI_APIS = [
    (q) => `https://mistral.stacktoy.workers.dev/?apikey=Suhail&text=${encodeURIComponent(q)}`,
    (q) => `https://llama.gtech-apiz.workers.dev/?apikey=Suhail&text=${encodeURIComponent(q)}`
];

const askAI = async (query) => {
    for (const apiUrl of AI_APIS) {
        try {
            const { data } = await axios.get(apiUrl(query), { timeout: 15000 });
            const response = data?.data?.response;
            if (response && typeof response === 'string' && response.trim()) return response.trim();
        } catch { continue; }
    }
    return null;
};

cmd({
    pattern: "chatbot",
    alias: ["aichat", "botchat"],
    use: '.chatbot <on|off>',
    desc: "Enable/Disable AI auto-reply in this group",
    category: "admin",
    react: "🤖",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isGroup, isAdmins }) => {
    if (!isGroup) return reply('❌ Group only command.');
    if (!isAdmins) return reply('❌ Only admins can use this.');

    const action = q ? q.toLowerCase().trim() : '';
    global.chatbotGroups = global.chatbotGroups || new Set();

    if (action === 'on') {
        global.chatbotGroups.add(from);
        reply('✅ *Chatbot Enabled!*\n\nMention me or reply to my messages to chat.');
    } else if (action === 'off') {
        global.chatbotGroups.delete(from);
        reply('❌ *Chatbot Disabled.*');
    } else {
        reply(`Usage: .chatbot on/off`);
    }
},

// Group එකේ මැසේජ් ආවම වැඩ කරන කොටස
{
    on: 'body',
    async body(conn, mek, m, { from, sender, body }) {
        if (!from.endsWith('@g.us') || mek.key.fromMe) return;
        global.chatbotGroups = global.chatbotGroups || new Set();
        if (!global.chatbotGroups.has(from)) return;

        const botId = conn.user.id.split(':')[0] + '@s.whatsapp.net';
        const mentionedJid = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const isReplyToBot = m.quoted?.sender === botId;

        if (!mentionedJid.includes(botId) && !isReplyToBot) return;
        if (!body) return;

        try {
            await conn.sendPresenceUpdate('composing', from);
            const response = await askAI(body);
            if (response) {
                await conn.sendMessage(from, { text: response }, { quoted: mek });
            }
        } catch (e) { console.error('Chatbot Error:', e.message); }
    }
});
