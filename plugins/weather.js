const axios = require('axios');
const { cmd } = require('../command');

cmd({
    pattern: "weather",
    alias: ["forecast", "climate"],
    use: '.weather <city>',
    desc: "Get the current weather for a city",
    category: "info",
    react: "🌤️",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply("*Please provide a place to search.*\nExample: .weather Colombo");

    try {
        const apiKey = '060a6bcfa19809c2cd4d97a212b19273';
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(q)}&units=metric&appid=${apiKey}`);
        const weather = response.data;

        const weatherText = `ʜᴇʀᴇ ɪs ʏᴏᴜʀ ᴘʟᴀᴄᴇ ᴡᴇᴀᴛʜᴇʀ\n\n` +
            `「 🌅 」ᴘʟᴀᴄᴇ: ${weather.name}\n` +
            `「 🗺️ 」ᴄᴏᴜɴᴛʀʏ: ${weather.sys.country}\n` +
            `「 🌤️ 」ᴠɪᴇᴡ: ${weather.weather[0].description}\n` +
            `「 🌡️ 」ᴛᴇᴍᴘᴇʀᴀᴛᴜʀᴇ: ${weather.main.temp}°C\n` +
            `「 💦 」ʜᴜᴍɪᴅɪᴛʏ: ${weather.main.humidity}%\n` +
            `「 🌬️ 」ᴡɪɴᴅ sᴘᴇᴇᴅ: ${weather.wind.speed} km/h`;

        await conn.sendMessage(from, { text: weatherText }, { quoted: mek });
    } catch (error) {
        console.error('Weather error:', error);
        reply('❌ Sorry, I could not fetch the weather. Make sure the city name is correct.');
    }
});
