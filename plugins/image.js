// plugins/image.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

const FIXO_API_KEY = config.FIXO_API_KEY;
const NEWSLETTER_JID = "120363409660898486@newsletter";
const NEWSLETTER_URL = "https://whatsapp.com/channel/120363409660898486";

cmd({
    pattern: "img",
    alias: ["image", "pic", "photo"],
    use: '.img <query>',
    desc: "Search and download an image",
    category: "search",
    react: "🖼️",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!FIXO_API_KEY) return reply('❌ *API Key Error:*\n`config.env` is missing FIXO_API_KEY.');
    if (!q) return reply('❌ *Please provide a search query.*\n\n📌 *Example:*\n.img Mahaweli River');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        const apiUrl = `https://fixo-api-p15j.onrender.com/api/image?query=${encodeURIComponent(q)}&api_key=${FIXO_API_KEY}`;
        const { data } = await axios.get(apiUrl, { timeout: 20000 });

        if (!data.success || !data.images || data.images.length === 0) {
            throw new Error("No images found for this query.");
        }

        // ලින්ක්ස් ටික Shuffle කරනවා
        const shuffled = data.images.sort(() => 0.5 - Math.random());
        let imageBuffer = null;

        // එකින් එක ලින්ක් ට්‍රයි කරලා, ඇත්තටම ඉමේජ් එකක්ද බලනවා
        for (const imgUrl of shuffled) {
            try {
                const imgRes = await axios.get(imgUrl, {
                    responseType: 'arraybuffer',
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'image/*,*/*;q=0.8'
                    }
                });
                
                // ⚠️ වැදගත්: එවපු එක ඉමේජ් එකක්ද කියලා Content-Type එකෙන් බලනවා
                const contentType = imgRes.headers['content-type'];
                if (contentType && contentType.startsWith('image/') && imgRes.data.length > 0) {
                    imageBuffer = Buffer.from(imgRes.data, 'binary');
                    break; // හරි ඉමේජ් එකක් හම්බුනා නම් ලූප් එකෙන් එළියට එනවා
                }
            } catch (err) {
                continue; // අවුල් ගියොත් ඊළඟ එකට යනවා
            }
        }

        if (!imageBuffer) {
            throw new Error("Failed to download a valid image from the search results.");
        }

        const caption = 
            `✅ *IMAGE SEARCH*\n\n` +
            `🔎 *Query:* ${q}\n\n` +
            `⚡ *Powered by Queen Zara*\n\n` +
            `📢 *Join our Newsletter:*\n` +
            `${NEWSLETTER_URL}`;

        await conn.sendMessage(from, {
            image: imageBuffer,
            caption: caption,
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
        console.error('[img] Error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error searching image:*\n_${e.message}_`);
    }
});
