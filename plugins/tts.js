// plugins/tts.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

const FIXO_API_KEY = config.FIXO_API_KEY;
const NEWSLETTER_JID = "120363409660898486@newsletter";
const NEWSLETTER_URL = "https://whatsapp.com/channel/120363409660898486";

cmd({
    pattern: "tts",
    alias: ["say", "voice"],
    use: '.tts <text>',
    desc: "Convert text to speech",
    category: "utility",
    react: "🗣️",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!FIXO_API_KEY) return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');
    if (!q) return reply('❌ *Please provide text.*\n\n📌 *Example:*\n.tts Hello\n.tts ආයුබෝවන්');

    let lang = 'en'; 
    let textToSpeak = q.trim();

    // 1. යූසර් ලංග්වේජ් කෝඩ් එකක් (උදා: si, ta, en) දීලා තියෙනවද බලනවා
    const args = textToSpeak.split(' ');
    if (args.length > 1 && args[0].length === 2 && /^[a-z]{2}$/.test(args[0])) {
        lang = args[0];
        textToSpeak = args.slice(1).join(' ');
    } else {
        // 2. ලංග්වේජ් කෝඩ් එකක් නැත්නම්, අකුරු වලින් ඔටෝම ඩිටෙක්ට් කරනවා
        if (/[\u0D80-\u0DFF]/.test(textToSpeak)) {
            lang = 'si'; // සිංහල අකුරු
        } else if (/[\u0B80-\u0BFF]/.test(textToSpeak)) {
            lang = 'ta'; // දෙමළ අකුරු
        }
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // API එකට lang එකත් එක්කම යවනවා
        const apiUrl = `https://fixo-api-p15j.onrender.com/api/tts?text=${encodeURIComponent(textToSpeak)}&lang=${lang}&api_key=${FIXO_API_KEY}`;
        const res = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 30000 });

        const buffer = Buffer.from(res.data, 'binary');

        await conn.sendMessage(from, {
            audio: buffer,
            mimetype: 'audio/mpeg',
            ptt: false, // සාමාන්‍ය audio file එකක් විදියට යවනවා
            fileName: 'tts.mp3',
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
        console.error('[tts] Error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error generating TTS:*\n_${e.message}_`);
    }
});
