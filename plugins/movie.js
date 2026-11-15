const { cmd } = require('../command');
const mrnima = require('mrnima-moviedl'); // ඔයාගේ package.json එකේ තියෙනවා

cmd({
    pattern: "movie",
    alias: ["sinhalasub", "msub"],
    use: '.movie <name>',
    desc: "Search and download movies with Sinhala Subtitles",
    category: "download",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('🎬 *Movie Downloader*\n\nUsage:\n.movie <movie name>\nExample: .movie Avatar 2');

    try {
        await reply(`🔍 *Searching for "${q}"...*`);

        // mrnima-moviedl පාවිච්චි කරලා සර්ච් කරනවා
        const searchResults = await mrnima.search(q);
        
        if (!searchResults || !searchResults.result || searchResults.result.length === 0) {
            return reply('❌ No movies found for that name.');
        }

        const movie = searchResults.result[0]; // පළවෙනි රිසල්ට් එක ගන්නවා
        const downloadData = await mrnima.dl_sinhalasub(movie.link);

        if (!downloadData || !downloadData.result || !downloadData.result.dl_links) {
            return reply('❌ Could not get download links. Try another movie.');
        }

        let caption = `🎬 *${movie.title}*\n\n`;
        caption += `⭐ *Rating:* ${movie.rating || 'N/A'}\n`;
        caption += `📅 *Year:* ${movie.year || 'N/A'}\n\n`;
        caption += `📥 *Download Links:*\n`;

        // ඩවුන්ලෝඩ් ලින්ක්ස් ටික වෙන් කරලා ගන්නවා
        const links = downloadData.result.dl_links;
        for (const link of links) {
            caption += `🔗 *${link.quality}* - [Click Here](${link.link})\n`;
        }

        caption += `\n> _Powered by Queen Zara Mini_`;

        // Movie Poster එක එක්ක මැසේජ් එක යවනවා
        if (movie.image) {
            await conn.sendMessage(from, { image: { url: movie.image }, caption: caption }, { quoted: mek });
        } else {
            await conn.sendMessage(from, { text: caption }, { quoted: mek });
        }

    } catch (error) {
        console.error('Movie Error:', error.message);
        reply('❌ Failed to search or download the movie. API might be down.');
    }
});
