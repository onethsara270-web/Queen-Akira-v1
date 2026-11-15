const axios = require('axios');
const { cmd } = require('../command');

cmd({
    pattern: "news",
    alias: ["headlines"],
    use: '.news',
    desc: "Get latest news headlines",
    category: "info",
    react: "📰",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        const apiKey = 'dcd720a6f1914e2d9dba9790c188c08c'; // Free API key
        const response = await axios.get(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}`);
        
        if (!response.data || !response.data.articles) throw new Error('Invalid API');
        
        const articles = response.data.articles.slice(0, 5);
        if (articles.length === 0) return reply('❌ No news found at the moment.');

        let newsMessage = '📰 *Latest News*:\n\n';
        articles.forEach((article, index) => {
            newsMessage += `${index + 1}. *${article.title}*\n${article.description || 'No description'}\n\n`;
        });

        await conn.sendMessage(from, { text: newsMessage.trim() }, { quoted: mek });
    } catch (error) {
        console.error('News error:', error);
        reply('❌ Sorry, I could not fetch news right now.');
    }
});
