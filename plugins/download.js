const { cmd } = require('../command');
const config = require('../config');
const primesave = require('primesave-dl');
const { youtube, fbdown, ttdl, igdl, twitter } = require('btch-downloader');

const NEWSLETTER_JID = "120363409660898486@newsletter";

// බාගැනීම් සඳහා උපකාරක ශ්‍රිතය
async function fetchMedia(url) {
    // 1. මුලින්ම primesave-dl උත්සාහ කරන්න (බොහෝ විට ස්ථාවරයි)
    try {
        const data = await primesave(url);
        if (data.success && data.options && data.options.length > 0) {
            return {
                title: data.title || 'Downloaded Media',
                options: data.options
            };
        }
    } catch (e) {
        console.log('primesave-dl failed, trying btch-downloader...');
    }

    // 2. එය අසාර්ථක නම්, btch-downloader උත්සාහ කරන්න
    try {
        let data;
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            data = await youtube(url);
        } else if (url.includes('facebook.com') || url.includes('fb.watch')) {
            data = await fbdown(url);
        } else if (url.includes('tiktok.com')) {
            data = await ttdl(url);
        } else if (url.includes('instagram.com')) {
            data = await igdl(url);
        } else if (url.includes('twitter.com') || url.includes('x.com')) {
            data = await twitter(url);
        } else {
            throw new Error('Unsupported platform link.');
        }

        // btch-downloader ප්‍රතිඵලය primesave ආකෘතියට පරිවර්තනය කරන්න
        if (data && (data.mp4 || data.video || data.url)) {
            const videoUrl = data.mp4 || data.video || data.url;
            return {
                title: data.title || 'Downloaded Media',
                options: [{ type: 'Video', url: videoUrl }]
            };
        }
    } catch (e) {
        console.log('btch-downloader also failed:', e.message);
    }

    throw new Error('No downloadable media found at that link.');
}

cmd({
    pattern: "dl",
    alias: ["download", "fb", "ig", "tt", "yt", "tw"],
    use: '.dl <video URL>',
    desc: "Universal video downloader (No API Key)",
    category: "download",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('❌ *Please provide a video link.*\n\n📌 *Example:*\n.dl https://youtu.be/...');

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});
        await reply('⏳ *Fetching media, please wait...*');

        // බාගැනීම් ශ්‍රිතය කැඳවන්න
        const media = await fetchMedia(q);

        // හොඳම ගුණාත්මකභාවය සහිත වීඩියෝ විකල්පය තෝරන්න
        const videoOption = media.options.find(opt => opt.type === 'Video') || media.options[0];
        if (!videoOption || !videoOption.url) {
            throw new Error("Could not extract a direct media URL.");
        }

        // WhatsApp වෙත යවන්න (ඔබේ apk.js හි context style එකම)
        await conn.sendMessage(from, {
            video: { url: videoOption.url },
            mimetype: 'video/mp4',
            fileName: media.title ? `${media.title}.mp4` : 'video.mp4',
            caption: `✅ *${media.title}*\n\n⚡ *Powered by Queen Zara*`,
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
        console.error('[universal-dl] Error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error:* _${e.message}_`);
    }
});
