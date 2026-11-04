// plugins/emojimix.js
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME = "Queen Zara";
const TENOR_KEY = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ';
// ─────────────────────────────────────────

// sharp තියෙනවා නම් use කරන්න, නැත්නම් null
let sharp = null;
try { sharp = require('sharp'); } catch {}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

cmd({
    pattern: "emojimix",
    alias: ["emix", "mixemoji"],
    use: '.emojimix 😎+🥰',
    desc: "Mix two emojis into a sticker",
    category: "tools",
    react: "🎴",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    const args = (q || '').trim();
    if (!args || !args.includes('+')) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(
            `✳️ Separate the emojis with a *+* sign\n\n` +
            `📌 *Example:*\n` +
            `.emojimix 😎+🥰`
        );
    }

    const [emoji1, emoji2] = args.split('+').map(e => (e || '').trim());
    if (!emoji1 || !emoji2) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Invalid format.* Use `.emojimix 😎+🥰`');
    }

    let tempFile, outputFile;

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        // ── Tenor emoji kitchen ─────────────
        const url =
            `https://tenor.googleapis.com/v2/featured` +
            `?key=${TENOR_KEY}` +
            `&contentfilter=high` +
            `&media_filter=png_transparent` +
            `&component=proactive` +
            `&collection=emoji_kitchen_v5` +
            `&q=${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}`;

        const { data } = await axios.get(url, { timeout: 15000 });

        if (!data?.results?.length) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('❌ *These emojis cannot be mixed!*\n\nTry different ones.');
        }

        const imageUrl = data.results[0].url;

        // ── Download ────────────────────────
        const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 20000 });
        const buffer = Buffer.from(imgRes.data);

        // ── Convert to webp ─────────────────
        const tmpDir = path.join(os.tmpdir(), 'queen-zara');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        tempFile   = path.join(tmpDir, `emix_${Date.now()}.png`);
        outputFile = path.join(tmpDir, `emix_${Date.now()}.webp`);
        fs.writeFileSync(tempFile, buffer);

        let stickerBuffer = null;

        // 1) sharp
        if (sharp) {
            try {
                stickerBuffer = await sharp(buffer)
                    .resize(512, 512, {
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    })
                    .webp({ quality: 90 })
                    .toBuffer();
            } catch (e) {
                console.error('[emojimix] sharp:', e.message);
            }
        }

        // 2) ffmpeg fallback
        if (!stickerBuffer) {
            try {
                const ff =
                    `ffmpeg -y -i "${tempFile}" ` +
                    `-vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" ` +
                    `"${outputFile}"`;

                await new Promise((resolve, reject) => {
                    exec(ff, { timeout: 20000 }, (err) => err ? reject(err) : resolve());
                });

                if (fs.existsSync(outputFile)) {
                    stickerBuffer = fs.readFileSync(outputFile);
                }
            } catch (e) {
                console.error('[emojimix] ffmpeg:', e.message);
            }
        }

        // ── Send ────────────────────────────
        if (stickerBuffer) {
            await conn.sendMessage(from, { sticker: stickerBuffer }, { quoted: mek });
        } else {
            // Fallback: image විදිහට යවනවා
            await conn.sendMessage(from, {
                image: buffer,
                caption: `🎴 *${emoji1}+${emoji2}*\n\n⚡ ${BOT_NAME}`
            }, { quoted: mek });
        }

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (error) {
        console.error('[emojimix]', error);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(
            '❌ *Failed to mix emojis!*\n\n' +
            'Make sure you\'re using valid emojis.\n\n' +
            'Example: .emojimix 😎+🥰'
        );
    } finally {
        // ── Cleanup ─────────────────────────
        try { if (tempFile   && fs.existsSync(tempFile))   fs.unlinkSync(tempFile);   } catch {}
        try { if (outputFile && fs.existsSync(outputFile)) fs.unlinkSync(outputFile); } catch {}
    }
});
