// ============================================================
// 🔑 .password — sends the dashboard login for this bot (DM, owner only)
//   user bot  -> that user's 5-digit settings password + link
//   main bot  -> owner dashboard link (password is DASHBOARD_PASSWORD)
// ============================================================
const { cmd } = require('../command');
const config = require('../config');

cmd({
    pattern: 'password',
    alias: ['pass', 'settings'],
    desc: 'Get your dashboard password / settings link',
    category: 'owner',
    react: '🔑',
    filename: __filename
},
async (conn, mek, m, { from, isGroup, isOwner, reply }) => {
    try {
        if (!isOwner) return reply('❌ Owner only command.');
        if (isGroup) return reply('🔒 Send this command in a private chat with the bot.');

        const base = (global.BOT_DOMAIN || '').replace(/\/$/, '');
        let text;

        if (conn._isOwnerBot === false && conn._userInfo) {
            const userMgr = require('../user-manager');
            const user = userMgr.USERS[conn._userInfo.phone];
            if (!user || !user.dashPassword) return reply('❌ No password found for this number.');
            text = `*🔑 ${config.BOT_NAME} Settings*\n\n*Password:* ${user.dashPassword}\n` +
                   (base ? `*Link:* ${base}/user/settings?key=${user.dashPassword}\n` : '') +
                   `\n${config.DESCRIPTION}`;
        } else {
            text = `*🔑 ${config.BOT_NAME} Dashboard*\n\n*Password:* ${config.DASHBOARD_PASSWORD}\n` +
                   (base ? `*Link:* ${base}/login\n` : '') +
                   `\n${config.DESCRIPTION}`;
        }
        await conn.sendMessage(from, { text }, { quoted: mek });
    } catch (e) {
        console.error('password error:', e);
        reply(`An error occurred: ${e.message}`);
    }
});
