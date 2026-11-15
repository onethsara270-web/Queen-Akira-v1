const axios = require('axios');
const { cmd } = require('../command');

const AI_APIS = [
    (q) => `https://mistral.stacktoy.workers.dev/?apikey=Suhail&text=${encodeURIComponent(q)}`,
    (q) => `https://llama.gtech-apiz.workers.dev/?apikey=Suhail&text=${encodeURIComponent(q)}`,
    (q) => `https://mistral.gtech-apiz.workers.dev/?apikey=Suhail&text=${encodeURIComponent(q)}`
];

const askAI = async (query) => {
    for (const apiUrl of AI_APIS) {
        try {
            const { data } = await axios.get(apiUrl(query), { timeout: 15000 });
            const response = data?.data?.response;
            if (response && typeof response === 'string' && response.trim()) {
                return response.trim();
            }
        } catch { continue; }
    }
    throw new Error('All AI APIs failed');
};

cmd({
    pattern: "gpt",
    alias: ["ai", "chat", "ask"],
    use: '.gpt <question>',
    desc: "Ask a question to AI",
    category: "ai",
    react: "🤖",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('🤖 *AI Assistant*\n\nUsage: `.gpt <your question>`\nExample: `.gpt explain quantum physics`');

    try {
        const answer = await askAI(q);
        await conn.sendMessage(from, { text: answer }, { quoted: mek });
    } catch (error) {
        console.error('AI Command Error:', error.message);
        reply('❌ Failed to get AI response. Please try again later.');
    }
});
