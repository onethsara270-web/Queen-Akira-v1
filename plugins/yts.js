const yts = require('yt-search');
const { cmd } = require('../command');

cmd({
    pattern: "yts",
    alias: ["ytsearch", "playlist"],
    use: '.yts <query>',
    desc: "Search YouTube",
    category: "music",
    react: "🔍",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('Example: .yts Lil Peep');

    try {
        const result = await yts(q);
        const videos = result.videos.slice(0, 10);

        if (videos.length === 0) return reply('❌ No results found.');

        let searchText = `✨ *MUSIC SEARCH* ✨\n\n`;
        videos.forEach((v, index) => {
            searchText += `*${index + 1}.🎧 ${v.title}*\n`;
            searchText += `*⌚ Duration:* ${v.timestamp}\n`;
            searchText += `*👀 Views:* ${v.views}\n`;
            searchText += `*🔗 URL:* ${v.url}\n`;
            searchText += `──────────────────\n`;
        });

        await conn.sendMessage(from, {
            image: { url: videos[0].image },
            caption: searchText
        }, { quoted: mek });
    } catch (error) {
        console.error('YTS error:', error);
        reply('❌ Error searching YouTube.');
    }
});
