const { cmd } = require('../command');
const fs = require('fs');
const path = require('path');

// සෙටින්ග්ස් සේව් කරගන්න ෆයිල් එක
const CONFIG_PATH = path.join(__dirname, '../data/antitag.json');
if (!fs.existsSync(CONFIG_PATH)) {
    if (!fs.existsSync(path.dirname(CONFIG_PATH))) fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({}), 'utf8');
}

cmd({
    pattern: "antitag",
    alias: ["at", "tagblock"],
    use: '.antitag <on|off>',
    desc: "Prevent users from tagging all members",
    category: "admin",
    react: "🏷️",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isGroup, isAdmins }) => {
    if (!isGroup) return reply('❌ Group only command.');
    if (!isAdmins) return reply('❌ Only group admins can use this.');

    const action = q ? q.toLowerCase().trim() : '';
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

    if (action === 'on') {
        config[from] = { enabled: true, action: 'kick' }; // kick හෝ delete
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        reply('✅ *Antitag Enabled!* Users will be kicked for tagging all.');
    } else if (action === 'off') {
        config[from] = { enabled: false };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        reply('❌ *Antitag Disabled.*');
    } else {
        reply('Usage: .antitag on/off');
    }
},

// Tag හඳුනාගන්න කොටස
{
    on: 'body',
    async body(conn, mek, m, { from, sender, isGroup, isAdmins }) {
        if (!isGroup || isAdmins || mek.key.fromMe) return;
        
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        if (!config[from] || !config[from].enabled) return;

        const mentionedJid = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        // Members ලා 5ක් හෝ ඊට වැඩියෙන් Tag කරලා නම්
        if (mentionedJid.length >= 5) {
            try {
                await conn.sendMessage(from, { delete: mek.key });
                await conn.sendMessage(from, { text: `🚫 @${sender.split('@')[0]} removed for tagging all members.`, mentions: [sender] });
                await conn.groupParticipantsUpdate(from, [sender], 'remove');
            } catch (e) { console.log('Antitag kick error:', e.message); }
        }
    }
});
