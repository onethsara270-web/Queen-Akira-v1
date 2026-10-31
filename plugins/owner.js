// ============================================================
// 👤 OWNER — sends the owner contact card + channel links
// ============================================================
const { cmd } = require('../command');
const config = require('../config');
const channels = require('../lib/channels');

cmd({
    pattern: 'owner',
    alias: ['creator', 'dev'],
    desc: 'Show bot owner contact',
    category: 'main',
    react: '👤',
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const name = config.OWNER_NAME;
        const number = String(config.OWNER_NUMBER).replace(/[^0-9]/g, '');

        const vcard = 'BEGIN:VCARD\n' +
            'VERSION:3.0\n' +
            `FN:${name}\n` +
            `ORG:${config.BOT_NAME};\n` +
            `TEL;type=CELL;type=VOICE;waid=${number}:+${number}\n` +
            'END:VCARD';

        await conn.sendMessage(from, {
            contacts: { displayName: name, contacts: [{ vcard }] }
        }, { quoted: mek });

        const cfg = conn._userConfig || config._base || {};
        const links = channels.getChannelLinks(cfg);
        let text = `*👤 Owner :* ${name}\n*📞 Number :* wa.me/${number}\n`;
        if (links.length) text += `\n*📢 Channel${links.length > 1 ? 's' : ''} :*\n` + links.map(l => `• ${l}`).join('\n') + '\n';
        text += `\n${config.DESCRIPTION}`;
        await conn.sendMessage(from, { text }, { quoted: mek });
    } catch (e) {
        console.error('owner error:', e);
        reply(`An error occurred: ${e.message}`);
    }
});
