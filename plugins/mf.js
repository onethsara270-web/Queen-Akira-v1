// plugins/mediafire.js
const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME = "Queen Zara";
// ─────────────────────────────────────────

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function pickUrl(s = '') {
    const m = String(s).match(/https?:\/\/\S+/i);
    return m ? m[0] : '';
}

function isMediaFire(url) {
    return /mediafire\.com/i.test(url);
}

cmd({
    pattern: "mediafire",
    alias: ["mf", "mfdl"],
    use: '.mediafire <mediafire link>',
    desc: "Download a file from MediaFire",
    category: "download",
    react: "📥",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    const url = pickUrl(q || '');
    if (!url) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(
            `❌ *Please provide a MediaFire link.*\n\n` +
            `📌 *Example:*\n` +
            `.mediafire https://www.mediafire.com/file/XXXXX/file.zip`
        );
    }

    if (!isMediaFire(url)) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Not a MediaFire link.*');
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        const res = await axios.get(url, {
            headers: { 'User-Agent': UA },
            timeout: 20000,
            maxRedirects: 5
        });

        const $ = cheerio.load(res.data);

        // ── Download URL ────────────────────
        let downloadUrl =
            $('#downloadButton').attr('href') ||
            $('a.input.popsok').attr('href') ||
            $('a[href*="download"]').first().attr('href');

        if (downloadUrl && downloadUrl.startsWith('//')) {
            downloadUrl = 'https:' + downloadUrl;
        }

        // ── Filename ────────────────────────
        let fileName =
            $('.dl-btn-label').attr('title')?.trim() ||
            $('.promo_ss_file_name').text().trim() ||
            $('.filename').text().trim() ||
            '';

        if (!fileName) {
            // fall back to URL slug
            const slug = url.split('/file/')[1]?.split('/')[1];
            fileName = slug ? decodeURIComponent(slug) : `mediafire_${Date.now()}`;
        }

        // ── File size ───────────────────────
        const fileSize =
            $('.promo_ss_file_size').text().trim() ||
            $('.details li:nth-child(1) span').text().trim() ||
            'Unknown';

        if (!downloadUrl) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('❌ *Could not find the download link.*\n\nMake sure the file is public and the link is valid.');
        }

        const caption =
            `╭━━━〔 𝗠𝗘𝗗𝗜𝗔𝗙𝗜𝗥𝗘 𝗗𝗟 〕━━━┈⊷\n` +
            `┃ 📝 *FILE NAME:* ${fileName}\n` +
            `┃ ⚖️ *FILE SIZE:* ${fileSize}\n` +
            `╰━━━━━━━━━━━━━━━━━━┈⊷\n\n` +
            `⚡ Powered by ${BOT_NAME}`;

        await conn.sendMessage(from, {
            document: { url: downloadUrl },
            mimetype: 'application/octet-stream',
            fileName,
            caption
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error('[mediafire]', e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error downloading from MediaFire:*\n_${e.message}_`);
    }
});