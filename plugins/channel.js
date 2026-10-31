// ============================================================
// 📢 CHANNEL COMMANDS — multi channel support
//   .channel / .channels        -> list channel links (everyone)
//   .addchannel <link>          -> add + follow another channel (owner)
//   .delchannel <number|link>   -> remove a channel link (owner)
// Channels are auto-followed every time the owner bot connects.
// ============================================================
const { cmd } = require('../command');
const config = require('../config');
const channels = require('../lib/channels');

function liveCfg(conn) { return conn._userConfig || config._base || {}; }

async function save(conn, links) {
    const patch = channels.toConfigPatch(links);
    if (typeof global.writeOwnerConfig === 'function') await global.writeOwnerConfig(patch);
    if (conn._userConfig) Object.assign(conn._userConfig, patch);
}

cmd({
    pattern: 'channel',
    alias: ['channels', 'newsletter'],
    desc: 'Show the bot channel links',
    category: 'main',
    react: '📢',
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    const links = channels.getChannelLinks(liveCfg(conn));
    if (!links.length) return reply('❌ No channel link is configured.');
    const text = `*📢 ${config.BOT_NAME} Channel${links.length > 1 ? 's' : ''}*\n\n` +
        links.map((l, i) => `*${i + 1}.* ${l}`).join('\n') + `\n\n${config.DESCRIPTION}`;
    await conn.sendMessage(from, { text }, { quoted: mek });
});

cmd({
    pattern: 'addchannel',
    alias: ['addch'],
    desc: 'Add (and follow) another channel link — owner only',
    category: 'owner',
    react: '➕',
    filename: __filename
},
async (conn, mek, m, { q, isOwner, reply }) => {
    if (!isOwner) return reply('❌ Owner only command.');
    if (conn._isOwnerBot === false) return reply('❌ Channels can only be changed from the main bot.');
    const link = channels.normalizeLink(q);
    if (!link) return reply('❌ Give a valid channel link.\n\nExample:\n.addchannel https://whatsapp.com/channel/XXXXXXXX');

    const links = channels.getChannelLinks(liveCfg(conn));
    if (links.includes(link)) return reply('⚠️ That channel is already in the list.');
    links.push(link);
    await save(conn, links);

    let followed = '';
    try {
        const info = await channels.followChannel(conn, link);
        followed = `\n✅ Followed: *${info.name || info.jid}*`;
    } catch (e) {
        followed = `\n⚠️ Saved, but could not follow now (${e.message}). It will retry on next start.`;
    }
    reply(`✅ Channel added (${links.length} total).${followed}`);
});

cmd({
    pattern: 'delchannel',
    alias: ['rmchannel', 'delch'],
    desc: 'Remove a channel link by number or link — owner only',
    category: 'owner',
    react: '➖',
    filename: __filename
},
async (conn, mek, m, { q, isOwner, reply }) => {
    if (!isOwner) return reply('❌ Owner only command.');
    if (conn._isOwnerBot === false) return reply('❌ Channels can only be changed from the main bot.');
    const links = channels.getChannelLinks(liveCfg(conn));
    if (!q) return reply('❌ Use: .delchannel <number or link>\n\n' + links.map((l, i) => `*${i + 1}.* ${l}`).join('\n'));

    let idx = /^\d+$/.test(q.trim()) ? parseInt(q, 10) - 1 : links.indexOf(channels.normalizeLink(q));
    if (idx < 0 || idx >= links.length) return reply('❌ Channel not found in the list.');
    const [removed] = links.splice(idx, 1);
    await save(conn, links);
    reply(`✅ Removed:\n${removed}\n\nRemaining: ${links.length}`);
});
