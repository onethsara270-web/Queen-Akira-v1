// ============================================================
// 🎬 YouTube Downloader — PREMIUM STYLE
// ============================================================
const config = require('../config');
const { cmd } = require('../command');
const axios = require('axios');
const yts = require('yt-search');
const { prepareWAMessageMedia } = require('@whiskeysockets/baileys');

const YT_THUMB_DEFAULT = 'https://i.postimg.cc/Y9VQtfYS/file-000000006b04821189e40920bd7a1471.png';
const NEWSLETTER_JID = "120363409660898486@newsletter";

if (!global.YT_PENDING) global.YT_PENDING = new Map();

// ============================================================
// ⭐ Config values
// ============================================================
function getConfig() {
    return {
        botName: config.BOT_NAME || 'Queen Zara 🧚',
        ownerName: config.OWNER_NAME || 'FIXO DEV',
        description: config.DESCRIPTION || '> © Powered by Queen Zara 🧚',
        aliveImg: config.ALIVE_IMG || YT_THUMB_DEFAULT
    };
}

// ============================================================
// ⭐ YouTube Thumbnail helpers
// ============================================================
function getYTThumbnail(videoId) {
    if (!videoId) return YT_THUMB_DEFAULT;
    return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
}

// ============================================================
// Helpers
// ============================================================
function isYTUrl(url) {
    return /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|music\.youtube\.com)/i.test(url);
}

function getYTId(url) {
    const regex = /(?:youtube\.com\/(?:.*v=|.*\/)|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// ============================================================
// Multi-API download (No API Key Required)
// ============================================================
async function tryAPIs(videoUrl, type) {
    const apis = [
        { name: 'DavidCyril', url: type === 'mp3'
            ? `https://apis.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(videoUrl)}`
            : `https://apis.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(videoUrl)}`,
            extract: (d) => d?.result?.download_url || d?.result?.downloadUrl || d?.result?.url || d?.url },
        { name: 'Siputzx', url: type === 'mp3'
            ? `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(videoUrl)}`
            : `https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(videoUrl)}`,
            extract: (d) => d?.data?.dl || d?.data?.url || d?.data?.downloadUrl },
        { name: 'Ryzendesu', url: type === 'mp3'
            ? `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(videoUrl)}`
            : `https://api.ryzendesu.vip/api/downloader/ytmp4?url=${encodeURIComponent(videoUrl)}`,
            extract: (d) => d?.url || d?.downloadUrl },
        { name: 'Naxor', url: type === 'mp3'
            ? `https://api.naxor.my.id/api/download/ytmp3?url=${encodeURIComponent(videoUrl)}`
            : `https://api.naxor.my.id/api/download/ytmp4?url=${encodeURIComponent(videoUrl)}`,
            extract: (d) => d?.result?.url || d?.result?.download_url },
        { name: 'Bk9', url: `https://bk9.fun/download/ytmp3?url=${encodeURIComponent(videoUrl)}`,
            extract: (d) => d?.BK9?.url || d?.BK9?.downloadUrl },
        { name: 'Vreden', url: `https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(videoUrl)}`,
            extract: (d) => d?.result?.download?.url || d?.result?.url },
        { name: 'Itzpire', url: type === 'mp3'
            ? `https://itzpire.com/download/youtube/mp3?url=${encodeURIComponent(videoUrl)}`
            : `https://itzpire.com/download/youtube/mp4?url=${encodeURIComponent(videoUrl)}`,
            extract: (d) => d?.data?.downloadUrl || d?.data?.url }
    ];

    for (const api of apis) {
        try {
            console.log(`🔍 Trying ${api.name}...`);
            const response = await axios.get(api.url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } });
            const url = api.extract(response.data);
            if (url && typeof url === 'string' && url.startsWith('http')) {
                console.log(`✅ ${api.name} success`);
                return url;
            }
        } catch (e) {
            console.log(`❌ ${api.name} failed: ${e.message}`);
        }
    }
    throw new Error('All APIs failed. Try again later.');
}

// ============================================================
// Process Download
// ============================================================
async function processDownload(conn, chatID, receivedMsg, num, data) {
    try {
        const { ytResult } = data;
        const { description } = getConfig();

        if (num < 1 || num > 3) {
            await conn.sendMessage(chatID, {
                text: `❌ *Invalid selection!*\n\nReply with:\n*1* = Audio\n*2* = Video\n*3* = Document`
            }, { quoted: receivedMsg });
            return;
        }

        const modeText = num === 1 ? '🎵 Audio (MP3)'
                       : num === 2 ? '🎬 Video (Playable)'
                       : '📁 Video Document';

        await conn.sendMessage(chatID, { react: { text: '⬇️', key: receivedMsg.key } });
        await conn.sendMessage(chatID, {
            text: `┏━━━━━━━━━━━━━━━━━━━━━┓
┃  ⏳ *DOWNLOADING...*  ┃
┗━━━━━━━━━━━━━━━━━━━━━┛

📥 *Format:* ${modeText}
📝 *Title:* ${ytResult.title.slice(0, 30)}...

⏳ *Please wait, this may take a moment...*`
        }, { quoted: receivedMsg });

        const apiType = num === 1 ? 'mp3' : 'mp4';
        const downloadUrl = await tryAPIs(ytResult.url, apiType);

        const title = ytResult.title || 'YouTube Media';
        const safeName = title.replace(/[^\w\s\-\.]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'media';

        // 🌟 Beautiful Context forward
        const contextInfo = {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: NEWSLETTER_JID,
                newsletterName: "Fixo API Updates",
                serverMessageId: -1
            }
        };

        if (num === 1) {
            await conn.sendMessage(chatID, {
                audio: { url: downloadUrl }, mimetype: 'audio/mpeg', ptt: false,
                contextInfo
            }, { quoted: receivedMsg });

            await conn.sendMessage(chatID, {
                document: { url: downloadUrl }, mimetype: 'audio/mpeg',
                fileName: `${safeName}.mp3`,
                caption: `✅ *AUDIO DOWNLOADED*\n\n🎵 *${title}*\n\n${description}`,
                contextInfo
            }, { quoted: receivedMsg });

        } else if (num === 2) {
            await conn.sendMessage(chatID, {
                video: { url: downloadUrl }, mimetype: 'video/mp4',
                caption: `✅ *VIDEO DOWNLOADED*\n\n🎬 *${title}*\n\n${description}`,
                contextInfo
            }, { quoted: receivedMsg });

            await conn.sendMessage(chatID, {
                document: { url: downloadUrl }, mimetype: 'video/mp4',
                fileName: `${safeName}.mp4`,
                caption: `✅ *VIDEO DOCUMENT*\n\n📁 *${title}*\n\n${description}`,
                contextInfo
            }, { quoted: receivedMsg });

        } else if (num === 3) {
            await conn.sendMessage(chatID, {
                document: { url: downloadUrl }, mimetype: 'video/mp4',
                fileName: `${safeName}.mp4`,
                caption: `✅ *VIDEO DOCUMENT*\n\n📁 *${title}*\n\n${description}`,
                contextInfo
            }, { quoted: receivedMsg });
        }

        await conn.sendMessage(chatID, { react: { text: '✅', key: receivedMsg.key } });
        console.log(`✅ YT ${modeText} sent: ${title}`);

    } catch (e) {
        console.error('❌ processDownload error:', e.message);
        try {
            await conn.sendMessage(chatID, {
                text: `❌ *Download Failed!*\n\n> ${e.message.slice(0, 200)}\n\n_Please try again later._`
            }, { quoted: receivedMsg });
        } catch (_) {}
    }
}

// ============================================================
// Extract Msg ID
// ============================================================
function extractMsgId(result) {
    if (!result) return null;
    if (typeof result === 'string') return result;
    if (result.key?.id) return result.key.id;
    if (result.id) return result.id;
    return null;
}

// ============================================================
// Send Button Selector
// ============================================================
async function sendButtonSelector(conn, from, mek, ytResult) {
    const { botName, description } = getConfig();
    const thumb = ytResult._thumb || ytResult.thumbnail || getYTThumbnail(ytResult.videoId) || YT_THUMB_DEFAULT;
    
    const title = ytResult.title || 'YouTube Media';
    const duration = ytResult.timestamp || 'N/A';
    const views = ytResult.views ? ytResult.views.toLocaleString() : 'N/A';
    const author = ytResult.author?.name || 'Unknown';

    const caption = `┏━━━━━━━━━━━━━━━━━━━━━┓
┃  🎬 *${botName.toUpperCase()}*  ┃
┗━━━━━━━━━━━━━━━━━━━━━┛

📌 *Title:* ${title}
⏱️ *Duration:* ${duration}
👤 *Channel:* ${author}
👁️ *Views:* ${views}

━━━━━━━━━━━━━━━━━━━━━━━
👇 *Tap the button below to select format*
━━━━━━━━━━━━━━━━━━━━━━━

${description}`;

    let media;
    try {
        media = await prepareWAMessageMedia(
            { image: { url: thumb } },
            { upload: conn.waUploadToServer }
        );
    } catch (e) {
        console.error('⚠️ Media failed:', e.message);
    }

    const msg = {
        viewOnceMessage: {
            message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage: {
                    body: { text: caption },
                    footer: { text: `✨ Powered by ${botName}` },
                    header: media ? {
                        title: '', hasMediaAttachment: true, imageMessage: media.imageMessage
                    } : {
                        title: '', hasMediaAttachment: false
                    },
                    nativeFlowMessage: {
                        buttons: [{
                            name: 'single_select',
                            buttonParamsJson: JSON.stringify({
                                title: '🎬 SELECT FORMAT',
                                sections: [{
                                    title: '📥 Download Options',
                                    rows: [
                                        { header: '🎵', title: 'Audio (MP3)', description: 'Download audio only', id: 'yt_1' },
                                        { header: '🎬', title: 'Video (Playable)', description: 'MP4 playable video', id: 'yt_2' },
                                        { header: '📁', title: 'Video Document', description: 'MP4 as document', id: 'yt_3' }
                                    ]
                                }]
                            })
                        }],
                        messageParamsJson: ''
                    },
                    contextInfo: {
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: NEWSLETTER_JID,
                            newsletterName: "Fixo API Updates",
                            serverMessageId: -1
                        }
                    }
                }
            }
        }
    };

    return await conn.relayMessage(from, msg, { quoted: mek });
}

// ============================================================
// Main Download Function
// ============================================================
async function downloadYT(conn, mek, from, query, reply) {
    try {
        const { botName, description } = getConfig();

        if (!query || query.trim().length === 0) {
            return reply(
                `┏━━━━━━━━━━━━━━━━━━━━━┓
┃  🎬 *${botName.toUpperCase()}*  ┃
┗━━━━━━━━━━━━━━━━━━━━━┛

*Usage:*
• \`.song <url or name>\`
• \`.video <url or name>\`

*Example:*
• \`.song Believer\`

${description}`
            );
        }

        query = query.trim();
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        console.log(`📤 YT: ${query}`);

        let ytResult;
        if (isYTUrl(query)) {
            const search = await yts({ videoId: getYTId(query) });
            ytResult = search;
        } else {
            const search = await yts(query);
            if (!search.videos || search.videos.length === 0) {
                throw new Error('No results found');
            }
            ytResult = search.videos[0];
        }

        if (!ytResult || !ytResult.url) {
            throw new Error('Video not found');
        }

        console.log(`✅ Found: ${ytResult.title}`);

        const videoId = ytResult.videoId || getYTId(ytResult.url);
        const thumbnailUrl = ytResult.thumbnail && ytResult.thumbnail.startsWith('http')
            ? ytResult.thumbnail
            : getYTThumbnail(videoId);
        
        ytResult._thumb = thumbnailUrl;

        const buttonEnabled = String(config.BUTTON).toLowerCase() === 'true';
        let msgId = null;

        if (buttonEnabled) {
            // ==========================================
            // BUTTON MODE
            // ==========================================
            const result = await sendButtonSelector(conn, from, mek, ytResult);
            msgId = extractMsgId(result);
            console.log(`✅ YT button selector sent — ID: ${msgId}`);

        } else {
            // ==========================================
            // NUMBER MODE (Premium Layout)
            // ==========================================
            const title = ytResult.title || 'YouTube Media';
            const duration = ytResult.timestamp || 'N/A';
            const views = ytResult.views ? ytResult.views.toLocaleString() : 'N/A';
            const author = ytResult.author?.name || 'Unknown';

            const selectMsg = `┏━━━━━━━━━━━━━━━━━━━━━┓
┃  🎬 *${botName.toUpperCase()}*  ┃
┗━━━━━━━━━━━━━━━━━━━━━┛

📌 *Title:* ${title}
⏱️ *Duration:* ${duration}
👤 *Channel:* ${author}
👁️ *Views:* ${views}

━━━━━━━━━━━━━━━━━━━━━━━
🛒 *Select a format below:*
━━━━━━━━━━━━━━━━━━━━━━━
*1* 🎵 Audio (MP3)
*2* 🎬 Video (Playable)
*3* 📁 Document (MP4)

💬 *Reply with a number (1-3)*
🔄 *You can select multiple options!*

${description}`;

            const sentMsg = await conn.sendMessage(from, {
                image: { url: thumbnailUrl },
                caption: selectMsg,
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
            msgId = sentMsg.key.id;
            console.log(`📝 YT number selector sent — ID: ${msgId}`);
        }

        // Save pending
        global.YT_PENDING.set(from, {
            messageID: msgId,
            ytResult,
            timestamp: Date.now(),
            processing: new Set(),
            mode: buttonEnabled ? 'button' : 'number'
        });

        setTimeout(() => {
            const p = global.YT_PENDING.get(from);
            if (p && p.messageID === msgId) {
                global.YT_PENDING.delete(from);
                console.log(`⏰ YT pending expired: ${from}`);
            }
        }, 5 * 60 * 1000);

    } catch (e) {
        console.error(`❌ YT error:`, e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`❌ Download failed!\n\n> ${e.message.slice(0, 200)}`);
    }
}

// ============================================================
// 🎯 BODY HANDLER — Buttons + Replies
// ============================================================
cmd({
    pattern: 'ytcatch',
    dontAddCommandList: true,
    on: 'body'
},
async (conn, mek, m, { from, body }) => {
    try {
        const text = (body || '').trim();
        if (!text) return;

        let num = null;
        if (/^[123]$/.test(text)) {
            num = parseInt(text);
        } else if (/^yt_[123]$/i.test(text)) {
            num = parseInt(text.replace(/^yt_/i, ''));
        }

        if (!num) return;

        const pending = global.YT_PENDING.get(from);
        if (!pending) return;

        if (Date.now() - pending.timestamp > 5 * 60 * 1000) {
            global.YT_PENDING.delete(from);
            return;
        }

        const isButtonClick = !!(
            mek.message?.interactiveResponseMessage ||
            mek.message?.listResponseMessage ||
            mek.message?.buttonsResponseMessage
        );

        const quotedId = mek.message?.extendedTextMessage?.contextInfo?.stanzaId;

        if (pending.mode === 'button' && isButtonClick) {
            console.log(`🎯 YT button click: ${num}`);
        } else if (pending.mode === 'number') {
            if (!quotedId || quotedId !== pending.messageID) {
                return;
            }
            console.log(`🎯 YT number reply: ${num}`);
        } else {
            return;
        }

        if (pending.processing.has(num)) {
            await conn.sendMessage(from, {
                text: `⏳ *Option ${num} is already downloading...* Please wait.`
            }, { quoted: mek });
            return;
        }

        pending.processing.add(num);

        try {
            await processDownload(conn, from, mek, num, pending);
        } finally {
            const p = global.YT_PENDING.get(from);
            if (p) p.processing.delete(num);
            if (p) p.timestamp = Date.now();
        }

    } catch (e) {
        console.error('❌ YT body error:', e.message);
    }
});

// ============================================================
// 🎬 .video COMMAND
// ============================================================
cmd({
    pattern: 'video',
    react: '🎥',
    desc: 'Download YouTube video',
    category: 'main',
    use: '.video < YT URL or Name>',
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    await downloadYT(conn, mek, from, q, reply);
});

// ============================================================
// 🎵 .song COMMAND
// ============================================================
cmd({
    pattern: 'song',
    react: '🎶',
    desc: 'Download YouTube song',
    category: 'main',
    use: '.song < YT URL or Name>',
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    await downloadYT(conn, mek, from, q, reply);
});
