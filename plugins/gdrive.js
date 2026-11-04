// plugins/gdrive.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME      = "Queen Zara";
const MAX_SIZE_MB   = 1500;              // 1.5 GB (WhatsApp document limit ~2GB)
const META_TIMEOUT  = 15000;
// ─────────────────────────────────────────

function humanSize(bytes) {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function extractFileId(url = '') {
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]{20,})/,
        /[?&]id=([a-zA-Z0-9_-]{20,})/,
        /\/d\/([a-zA-Z0-9_-]{20,})/
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
    }
    return null;
}

// Metadata only — stream එක abort කරනවා headers ආව ගමන්
async function fetchMeta(downloadUrl) {
    try {
        const res = await axios.get(downloadUrl, {
            responseType: 'stream',
            timeout: META_TIMEOUT,
            maxRedirects: 5,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            validateStatus: s => s < 400
        });

        const headers  = res.headers || {};
        const cd       = headers['content-disposition'] || '';
        const match    = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
        const fileName = match ? decodeURIComponent(match[1]) : null;

        const len    = parseInt(headers['content-length'] || '0', 10);
        const mime   = headers['content-type'] || 'application/octet-stream';

        res.data.destroy();   // abort, don't download

        return { fileName, size: len, mime };
    } catch (e) {
        console.error('[gdrive] meta:', e.message);
        return { fileName: null, size: 0, mime: 'application/octet-stream' };
    }
}

cmd({
    pattern: "gdrive",
    alias: ["gdl", "drivedl"],
    use: '.gdrive <google drive link>',
    desc: "Download a file from Google Drive",
    category: "download",
    react: "📥",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    const url = (q || '').trim();
    if (!url) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply('❌ *Please provide a Google Drive link.*\n\nExample:\n.gdrive https://drive.google.com/file/d/FILE_ID/view');
    }

    const fileId = extractFileId(url);
    if (!fileId) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Could not extract File ID from the link.*');
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // drive.usercontent.google.com → confirm token auto-handles large files
        const downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;

        const meta = await fetchMeta(downloadUrl);
        const fileName = meta.fileName || `gdrive_${fileId}`;
        const sizeStr  = humanSize(meta.size);

        // Size check
        if (meta.size && meta.size > MAX_SIZE_MB * 1024 * 1024) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply(`❌ *File too large:* ${sizeStr}\n\nMax allowed: ${MAX_SIZE_MB} MB`);
        }

        const caption =
            `╭━━━〔 𝗚𝗗𝗥𝗜𝗩𝗘 𝗗𝗟 〕━━━┈⊷\n` +
            `┃ 📝 *FILE NAME:* ${fileName}\n` +
            `┃ ⚖️ *FILE SIZE:* ${sizeStr}\n` +
            `╰━━━━━━━━━━━━━━━━━━┈⊷\n\n` +
            `⚡ Powered by ${BOT_NAME}`;

        await conn.sendMessage(from, {
            document: { url: downloadUrl },
            mimetype: meta.mime || 'application/octet-stream',
            fileName,
            caption
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error('[gdrive]', e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error downloading from GDrive:* ${e.message}`);
    }
});