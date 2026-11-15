const { cmd } = require('../command');

cmd({
    pattern: "imdb",
    alias: ["movie", "film"],
    use: '.imdb <movie name>',
    desc: "Get movie information from IMDB",
    category: "info",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('*Please provide a movie or series title.*\nExample: `.imdb Inception`');

    try {
        const res = await fetch(`https://api.popcat.xyz/imdb?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error(`API request failed`);
        
        const json = await res.json();
        const ratings = (json.ratings || []).map((r) => `⭐ *${r.source}:* ${r.value}`).join('\n') || 'No ratings available';

        const movieInfo = `
🎬 *${json.title || 'N/A'}* (${json.year || 'N/A'})
🎭 *Genres:* ${json.genres || 'N/A'}
📺 *Type:* ${json.type || 'N/A'}
📝 *Plot:* ${json.plot || 'N/A'}
⭐ *IMDB Rating:* ${json.rating || 'N/A'} (${json.votes || 'N/A'} votes)
🏆 *Awards:* ${json.awards || 'N/A'}
🎬 *Director:* ${json.director || 'N/A'}
👨‍👩‍👧‍👦 *Actors:* ${json.actors || 'N/A'}
⏱️ *Runtime:* ${json.runtime || 'N/A'}
📅 *Released:* ${json.released || 'N/A'}
🌐 *Country:* ${json.country || 'N/A'}
💰 *Box Office:* ${json.boxoffice || 'N/A'}

*Ratings:*
${ratings}
      `.trim();

        if (json.poster) {
            await conn.sendMessage(from, { image: { url: json.poster }, caption: movieInfo }, { quoted: mek });
        } else {
            await conn.sendMessage(from, { text: movieInfo }, { quoted: mek });
        }
    } catch (error) {
        console.error('IMDB error:', error);
        reply('❌ Failed to fetch movie information. Please try again later.');
    }
});
