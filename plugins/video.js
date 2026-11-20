const { cmd } = require('../command');
const config = require('../config');
const axios = require('axios');
const yts = require('yt-search');
const ffmpeg = require('fluent-ffmpeg');
// ඔයාගේ package.json එකේ තියෙන path එක මෙතනින් ගන්නවා
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path; 
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

async function searchVideo(query) {
    const search = await yts(query);
    if (!search.videos || search.videos.length === 0) throw new Error("🌸 No results found! 💕");
    return search.videos[0];
}

async function trimVideo(inputPath, outputPath, start, duration) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath).setStartTime(start).setDuration(duration).output(outputPath).on('end', () => resolve(outputPath)).on('error', reject).run();
    });
}

cmd({
    pattern: "video",
    alias: ["ytv", "video3", "video2", "video4"],
    desc: "Download YouTube video",
    category: "download",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply(`🎬 *Usage:* .video <name or link>\n✂️ *Trim:* .video <link> trim 00:00:10 00:00:30`);

        let args = q.split(' ');
        let query = q;
        let trimStart = null; let trimDuration = null;
        
        if (args.includes("trim") && args.length > 3) {
            const trimIndex = args.indexOf("trim");
            trimStart = args[trimIndex + 1];
            trimDuration = args[trimIndex + 2];
            query = args.slice(0, trimIndex).join(" ");
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        let videoUrl, videoTitle, videoThumb;
        if (query.includes('youtube.com') || query.includes('youtu.be')) {
            videoUrl = query;
            videoTitle = "YouTube Video";
        } else {
            const res = await searchVideo(query);
            videoUrl = res.url; videoTitle = res.title; videoThumb = res.thumbnail;
        }

        if (videoThumb) await conn.sendMessage(from, { image: { url: videoThumb }, caption: `🎬 *Downloading:* ${videoTitle}...` }, { quoted: mek });

        const api = `https://arslan-apis-v2.vercel.app/download/ytmp4?url=${encodeURIComponent(videoUrl)}`;
        const { data } = await axios.get(api, { timeout: 60000 });
        const downloadUrl = data?.result?.download?.url;

        if (!downloadUrl) throw new Error("🌸 API failed to provide link!");

        if (trimStart && trimDuration) {
            await conn.sendMessage(from, { react: { text: "✂️", key: mek.key } });
            const tempInput = path.join(tempDir, `in_${Date.now()}.mp4`);
            const tempOutput = path.join(tempDir, `out_${Date.now()}.mp4`);
            
            const writer = fs.createWriteStream(tempInput);
            const response = await axios({ url: downloadUrl, method: 'GET', responseType: 'stream' });
            response.data.pipe(writer);
            await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });
            
            await trimVideo(tempInput, tempOutput, trimStart, trimDuration);
            
            await conn.sendMessage(from, { video: { url: tempOutput }, mimetype: 'video/mp4', caption: `✂️ *Trimmed Video*\n${videoTitle}` }, { quoted: mek });
            fs.unlinkSync(tempInput); fs.unlinkSync(tempOutput);
        } else {
            await conn.sendMessage(from, { video: { url: downloadUrl }, mimetype: 'video/mp4', caption: `🎬 *${videoTitle}*\n\n👑 Powered by Queen Zara Mini` }, { quoted: mek });
        }

        await conn.sendMessage(from, { react: { text: "💖", key: mek.key } });

    } catch (err) {
        console.error('🌸 Video Error:', err);
        reply(`❌ Error: ${err.message}`);
    }
});
