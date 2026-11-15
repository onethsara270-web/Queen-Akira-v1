const axios = require('axios');
const { cmd } = require('../command');

cmd({
    pattern: "twitter",
    alias: ["xtweet", "tweetdl"],
    use: '.twitter <url>',
    desc: "Download media from X/Twitter post",
    category: "download",
    react: "🐦",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('Please provide a Twitter/X URL.\nExample: .twitter https://x.com/i/status/...');

    try {
        const apiUrl = `https://discardapi.dpdns.org/api/dl/twitter?apikey=guru&url=${encodeURIComponent(q)}`;
        const { data } = await axios.get(apiUrl, { timeout: 15000 });

        if (!data?.status || !data.result?.media?.length) {
            return reply('❌ No media found for this Tweet.');
        }

        const tweet = data.result;
        const caption = `📝 @${tweet.authorUsername} (${tweet.authorName})\n📅 ${tweet.date}\n❤️ Likes: ${tweet.likes} | 🔁 Retweets: ${tweet.retweets}\n\n💬 ${tweet.text}`;

        for (const mediaItem of tweet.media) {
            if (mediaItem.type === 'video') {
                await conn.sendMessage(from, { video: { url: mediaItem.url }, caption }, { quoted: mek });
            } else if (mediaItem.type === 'image') {
                await conn.sendMessage(from, { image: { url: mediaItem.url }, caption }, { quoted: mek });
            }
        }
    } catch (error) {
        console.error('Twitter error:', error);
        reply('❌ Failed to fetch Twitter/X media.');
    }
});
