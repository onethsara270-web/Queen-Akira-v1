const axios = require('axios');
const { cmd } = require('../command');

cmd({
    pattern: "gitclone",
    alias: ["git", "clone"],
    use: '.gitclone <github url>',
    desc: "Download GitHub repository as ZIP",
    category: "download",
    react: "🐙",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply('❌ *Missing Link!*\nExample: .gitclone https://github.com/user/repo');

    try {
        const regex = new RegExp('(?:https|git)(?://|@)github.com[/:]([^/:]+)/(.+)', 'i');
        if (!regex.test(q)) return reply('⚠️ *Invalid GitHub link!*');

        let [_, user, repo] = q.match(regex) || [];
        repo = repo.replace(/.git$/, '');
        
        const url = `https://api.github.com/repos/${user}/${repo}/zipball`;
        
        await reply(`✳️ *Wait, fetching ${repo}.zip...*`);

        // Check if repo exists first
        await axios.head(url);

        await conn.sendMessage(from, {
            document: { url },
            fileName: `${repo}.zip`,
            mimetype: 'application/zip',
            caption: `📦 *Repository:* ${user}/${repo}\n✨ *Cloned by Queen Zara Mini*`
        }, { quoted: mek });

    } catch (err) {
        console.error('Gitclone Error:', err.message);
        reply('❌ *Failed to download.* Make sure the repository is public and exists.');
    }
});
