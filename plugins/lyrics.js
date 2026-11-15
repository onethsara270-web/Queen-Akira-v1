const { cmd } = require('../command');

cmd({
    pattern: "lyrics",
    alias: ["lyric", "songlyrics"],
    use: '.lyrics <song name>',
    desc: "Get lyrics of a song",
    category: "music",
    react: "🎵",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('*Please enter the song name!*\nUsage: `.lyrics <song name>`');

    try {
        const apiUrl = `https://discardapi.dpdns.org/api/music/lyrics?apikey=qasim&song=${encodeURIComponent(q)}`;
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`API failed`);
        
        const data = await res.json();
        const messageData = data?.result?.message;

        if (!messageData?.lyrics) return reply(`❌ Could not find lyrics for "${q}".`);

        const { artist, lyrics, image, title, url } = messageData;
        const maxChars = 4000;
        const lyricsOutput = lyrics.length > maxChars ? `${lyrics.slice(0, maxChars - 3)}...` : lyrics;

        const caption = `🎵 *${title}*\n👤 *Artist:* ${artist}\n🔗 *URL:* ${url}\n\n📝 *Lyrics:*\n${lyricsOutput}`.trim();

        if (image) {
            await conn.sendMessage(from, { image: { url: image }, caption }, { quoted: mek });
        } else {
            await conn.sendMessage(from, { text: caption }, { quoted: mek });
        }
    } catch (error) {
        console.error('Lyrics error:', error);
        reply(`❌ An error occurred while fetching lyrics.`);
    }
});
