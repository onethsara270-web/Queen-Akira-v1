// plugins/npm.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

const FIXO_API_KEY = config.FIXO_API_KEY;
const NEWSLETTER_JID = "120363409660898486@newsletter";
const NEWSLETTER_URL = "https://whatsapp.com/channel/120363409660898486";

cmd({
    pattern: "npm",
    alias: ["npmv", "npmsearch"],
    use: '.npm <package>',
    desc: "Check NPM package details",
    category: "utility",
    react: "📦",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!FIXO_API_KEY) return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');
    if (!q) return reply('❌ *Please provide a package name.*\n\n📌 *Example:*\n.npm express');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        const apiUrl = `https://fixo-api-p15j.onrender.com/api/npm?q=${encodeURIComponent(q)}&api_key=${FIXO_API_KEY}`;
        const res = await axios.get(apiUrl, { timeout: 20000, validateStatus: s => s < 500 });
        
        if (!res.data.success) {
            throw new Error(res.data.error || "Package not found.");
        }

        const data = res.data;

        const caption = 
            `📦 *NPM PACKAGE INFO*\n\n` +
            `📝 *Name:* ${data.name}\n` +
            `ℹ️ *Description:* ${data.description}\n` +
            `👨‍💻 *Author:* ${data.author}\n\n` +
            `🚀 *Latest Version:* ${data.latest}\n` +
            `🔢 *Total Versions:* ${data.totalVersions}\n\n` +
            `🕒 *Recent Versions:*\n${data.versions.map(v => `• ${v}`).join('\n')}\n\n` +
            `⚡ *Powered by Queen Zara*\n\n` +
            `📢 *Join our Newsletter:*\n` +
            `${NEWSLETTER_URL}`;

        await conn.sendMessage(from, {
            text: caption,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: NEWSLETTER_JID,
                    newsletterName: "Fixo API Updates",
                    serverMessageId: -1
                }
            }
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
    } catch (e) {
        console.error('[npm] Error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error fetching NPM package:*\n_${e.message}_`);
    }
});
