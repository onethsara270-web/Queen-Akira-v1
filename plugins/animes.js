const axios = require('axios');
const { cmd } = require('../command');

const supportedAnimes = [
    'akira', 'akiyama', 'anna', 'asuna', 'ayuzawa', 'boruto', 'chiho', 'chitoge',
    'deidara', 'erza', 'elaina', 'eba', 'emilia', 'hestia', 'hinata', 'inori',
    'isuzu', 'itachi', 'itori', 'kaga', 'kagura', 'kaori', 'keneki', 'kotori',
    'kurumi', 'madara', 'mikasa', 'miku', 'minato', 'naruto', 'nezuko', 'sagiri',
    'sasuke', 'sakura'
];

cmd({
    pattern: "animes",
    alias: ["anime", "animeimg"],
    use: '.animes <name>',
    desc: "Send random anime images",
    category: "menu",
    react: "🎀",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    const typeLower = q ? q.toLowerCase().trim() : '';

    if (!typeLower || !supportedAnimes.includes(typeLower)) {
        return reply(`🎀 *Animes Menu* 🎀\n\n` + supportedAnimes.join(' | ') + `\n\n📌 *Usage:* .animes naruto`);
    }

    try {
        const apiUrl = `https://raw.githubusercontent.com/Guru322/api/Guru/BOT-JSON/anime-${typeLower}.json`;
        const res = await axios.get(apiUrl, { timeout: 15000 });
        const images = res.data;

        if (!Array.isArray(images) || images.length === 0) throw new Error('No images found');

        // Random 3 images ගන්නවා
        const randomImages = images.sort(() => 0.5 - Math.random()).slice(0, 3);

        for (const img of randomImages) {
            const imageData = await axios.get(img, { responseType: 'arraybuffer', timeout: 15000 });
            await conn.sendMessage(from, { image: Buffer.from(imageData.data), caption: `_${typeLower}_` }, { quoted: mek });
        }
    } catch (err) {
        console.error('Anime error:', err.message);
        reply('❌ Failed to fetch anime images.');
    }
});
