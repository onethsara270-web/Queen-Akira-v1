// ============================================================
// 📢 CHANNEL STATUS — post an update to your WhatsApp channel(s)
//   .chstatus <text>                -> main channel (NEWSLETTER_JID)
//   .chstatus 2 <text>              -> channel number 2 from .channels
//   .chstatus all <text>            -> every configured channel
//   .chstatus <channel link> <text> -> a specific channel
//   reply to image/video/audio + .chstatus [caption]
// Owner only. The bot account must be admin/owner of the channel.
// ============================================================
const { cmd } = require('../command');
const config = require('../config');
const channels = require('../lib/channels');
const { buildContent } = require('../lib/statusMedia');

cmd({
    pattern: 'chstatus',
    alias: ['channelstatus', 'cstatus'],
    desc: 'Post a WhatsApp channel update (text / image / video / audio)',
    category: 'owner',
    react: '📢',
    filename: __filename
},
async (conn, mek, m, { from, q, args, isOwner, reply }) => {
    try {
        if (!isOwner) return reply('❌ Owner only command.');
        const cfg = conn._userConfig || config._base || {};
        const links = channels.getChannelLinks(cfg);

        let targets = [];
        let text = q || '';
        const first = args[0] || '';

        if (first.toLowerCase() === 'all') {
            text = args.slice(1).join(' ');
            for (const l of links) { const r = await channels.resolveChannelJid(conn, l).catch(() => null); if (r) targets.push(r.jid); }
        } else if (/^\d{1,2}$/.test(first) && links[parseInt(first, 10) - 1]) {
            text = args.slice(1).join(' ');
            const r = await channels.resolveChannelJid(conn, links[parseInt(first, 10) - 1]).catch(() => null);
            if (r) targets.push(r.jid);
        } else if (channels.extractInviteCode(first)) {
            text = args.slice(1).join(' ');
            const r = await channels.resolveChannelJid(conn, first).catch(() => null);
            if (r) targets.push(r.jid);
        } else if (/@newsletter$/.test(first)) {
            text = args.slice(1).join(' ');
            targets.push(first);
        } else {
            targets.push(cfg.NEWSLETTER_JID || config.NEWSLETTER_JID);
        }

        targets = [...new Set(targets.filter(Boolean))];
        if (!targets.length) return reply('❌ Channel not found.');

        const content = await buildContent(m, text);
        if (!content) return reply('❌ Give a text or reply to an image / video / audio.\n\nExample: .chstatus Hello subscribers');

        let ok = 0; const errs = [];
        for (const jid of targets) {
            try {
                // fixo-baileys 1.0.7 has a real channel-status API; fall back to a normal channel message
                if (typeof conn.sendChannelStatus === 'function') await conn.sendChannelStatus(jid, content);
                else await conn.sendMessage(jid, content);
                ok++;
            }
            catch (e) { errs.push(`${jid}: ${e.message}`); }
        }
        await conn.sendMessage(from, { react: { text: ok ? '✅' : '❌', key: mek.key } });
        reply(`📢 Channel status posted: ${ok}/${targets.length}` + (errs.length ? `\n\n⚠️ ${errs.join('\n')}\n(The bot account must be admin/owner of the channel.)` : ''));
    } catch (e) {
        console.error('chstatus error:', e);
        reply(`❌ Could not post channel status: ${e.message}`);
    }
});
