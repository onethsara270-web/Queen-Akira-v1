const { cmd } = require('../command');
const axios = require("axios");
const cheerio = require("cheerio");
const { URL } = require("url");
const config = require('../config');

const BASE_URL = "https://www.mp4moviez.ad";
let isDownloading = false;

async function getThumbnailBuffer(url) {
    if (!url) return null;
    try {
        const { data } = await axios.get(url, { responseType: "arraybuffer" });
        return Buffer.from(data); // Removed sharp to avoid dependency issues
    } catch { return null; }
}

cmd({
    pattern: "movie",
    alias: ["mp4moviez", "film", "moviez", "mp4m"],
    desc: "Search and download movies from Mp4Moviez",
    category: "download",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    const query = q.trim();
    if (!query) return reply("🔎 *Please provide a movie name!*\n\nExample: .movie Animal");

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        const SEARCH_URL = `${BASE_URL}/search/${encodeURIComponent(query)}.html`;
        const { data } = await axios.get(SEARCH_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
        const $ = cheerio.load(data);
        const results = [];

        $("body > div").each((i, el) => {
            const aTag = $(el).find("a").first();
            const href = aTag.attr("href");
            const title = aTag.find("div > div:nth-child(2)").text().trim();
            if (href && title) results.push({ title: title, link: new URL(href, BASE_URL).href });
        });

        if (!results.length) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply("❌ No movies found. Please try different keywords.");
        }

        let listText = `🎬 *MP4MOVIEZ SEARCH*\n\n🔎 *Results for:* ${query.toUpperCase()}\n\n`;
        results.slice(0, 10).forEach((m, i) => {
            listText += `*${i + 1}.* ${m.title}\n`;
        });
        listText += `\n👉 *Reply with the number (1-10)* to select a movie.`;

        const sentMsg = await reply(listText);
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

        // Listener for user selection
        const movieHandler = async (update) => {
            try {
                const incoming = update.messages?.[0];
                if (!incoming?.message || incoming.key.remoteJid !== from) return;

                const textMsg = incoming.message.conversation || incoming.message.extendedTextMessage?.text || '';
                const quotedId = incoming.message.extendedTextMessage?.contextInfo?.stanzaId;
                
                if (quotedId !== sentMsg.key.id) return; // Must reply to the list
                
                const selectedIndex = parseInt(textMsg.trim()) - 1;
                if (isNaN(selectedIndex) || !results[selectedIndex]) return;

                conn.ev.off("messages.upsert", movieHandler); // Stop listening
                await conn.sendMessage(from, { react: { text: "📑", key: incoming.key } });

                const selected = results[selectedIndex];
                const { data: html } = await axios.get(selected.link, { headers: { "User-Agent": "Mozilla/5.0" } });
                const $$ = cheerio.load(html);
                
                let movieTitle = $$("h1").first().text().trim();
                let poster = $$(".posterss").attr("src");
                poster = poster ? new URL(poster, selected.link).href : null;

                let secondPage = null;
                $$("body > div.mast > a").each((i, el) => {
                    const href = $$(el).attr("href");
                    if (href && href.includes(".html")) secondPage = new URL(href, selected.link).href;
                });

                if (!secondPage) return reply("❌ No download links found.");

                const { data: page2 } = await axios.get(secondPage);
                const $$$ = cheerio.load(page2);
                const downloads = [];

                $$$(".mast").each((i, el) => {
                    const a = $$$(el).find("a");
                    const href = a.attr("href");
                    if (!href || !href.includes("dl.php")) return;
                    const sizeMatch = $$$(el).text().match(/\[(.*?)\]/);
                    downloads.push({ title: a.text().trim(), link: new URL(href, BASE_URL).href, size: sizeMatch ? sizeMatch[1] : "Unknown" });
                });

                if (!downloads.length) return reply("❌ No download links found.");

                let dlText = `🎬 *${movieTitle}*\n\n📥 *Select Quality:*\n\n`;
                downloads.slice(0, 10).forEach((d, i) => {
                    dlText += `*${i + 1}.* ${d.title} [${d.size}]\n`;
                });
                dlText += `\n👉 *Reply with the number* to download.`;

                const dlMsg = await conn.sendMessage(from, { image: { url: poster }, caption: dlText }, { quoted: incoming });

                const dlHandler = async (dlUpdate) => {
                    const dlIncoming = dlUpdate.messages?.[0];
                    if (!dlIncoming?.message || dlIncoming.key.remoteJid !== from) return;
                    
                    const dlQuoted = dlIncoming.message.extendedTextMessage?.contextInfo?.stanzaId;
                    if (dlQuoted !== dlMsg.key.id) return;
                    
                    const dlTextMsg = dlIncoming.message.conversation || dlIncoming.message.extendedTextMessage?.text || '';
                    const dlIndex = parseInt(dlTextMsg.trim()) - 1;

                    if (isNaN(dlIndex) || !downloads[dlIndex]) return;
                    
                    conn.ev.off("messages.upsert", dlHandler);
                    await conn.sendMessage(from, { react: { text: "📥", key: dlIncoming.key } });
                    
                    const target = downloads[dlIndex];
                    await conn.sendMessage(from, {
                        document: { url: target.link },
                        mimetype: "video/mp4",
                        fileName: `${movieTitle}.mp4`,
                        caption: `✅ *${movieTitle}*\n📦 Size: ${target.size}\n\n> Powered by Queen Zara Mini`
                    }, { quoted: dlIncoming });
                };

                conn.ev.on("messages.upsert", dlHandler);
                setTimeout(() => conn.ev.off("messages.upsert", dlHandler), 300000);

            } catch (e) { console.error('Movie Handler Error:', e); }
        };

        conn.ev.on("messages.upsert", movieHandler);
        setTimeout(() => conn.ev.off("messages.upsert", movieHandler), 300000);

    } catch (err) {
        console.error('MP4Moviez Error:', err);
        reply(`❌ Error processing movie search.`);
    }
});
