// ============================================================
// 👥 GROUP STATUS — post a status inside a WhatsApp group
//   .gstatus <text>                    -> text status in this group
//   reply to image/video/audio + .gstatus [caption]
//   .gstatus <group link|jid> <text>   -> post to another group (owner)
// Allowed: owner, or group admins.
// ============================================================
const { cmd } = require('../command');
const config = require('../config');
const { buildContent } = require('../lib/statusMedia');

async function postGroupStatus(conn, jid, content) {
    // fixo-baileys has native support: sendMessage(jid, { groupStatusMessage: content })
    try { return await conn.sendMessage(jid, { groupStatusMessage: content }); }
    catch (e) { console.log('gstatus native send failed, trying relay:', e.message); }
    const baileys = require('fixo-baileys');
    const { generateWAMessageContent } = baileys;
    const inner = await generateWAMessageContent(content, { upload: conn.waUploadToServer });
    const messageId = typeof baileys.generateMessageIDV2 === 'function'
        ? baileys.generateMessageIDV2(conn.user?.id)
        : (baileys.generateMessageID ? baileys.generateMessageID() : undefined);
    await conn.relayMessage(jid, { groupStatusMessageV2: { message: inner } }, { messageId });
}

cmd({
    pattern: 'gstatus',
    alias: ['groupstatus', 'gcstatus'],
    desc: 'Post a WhatsApp group status (text / image / video / audio)',
    category: 'group',
    react: '👥',
    filename: __filename
},
async (conn, mek, m, { from, q, args, isGroup, isOwner, isAdmins, reply }) => {
    try {
        let target = from;
        let text = q || '';

        // optional target group: invite link or jid
        if (args[0] && (/chat\.whatsapp\.com\//i.test(args[0]) || /@g\.us$/.test(args[0]))) {
            if (!isOwner) return reply('❌ Only the owner can post to another group.');
            const first = args[0];
            text = args.slice(1).join(' ');
            if (/@g\.us$/.test(first)) target = first;
            else {
                const code = first.split('chat.whatsapp.com/')[1].split(/[?\s]/)[0];
                const info = await conn.groupGetInviteInfo(code);
                target = info.id;
            }
        } else {
            if (!isGroup) return reply('❌ Use this in a group, or give a group link:\n.gstatus <group link> <text>');
            if (!isOwner && !isAdmins) return reply('❌ Group admins or the owner only.');
        }

        const content = await buildContent(m, text);
        if (!content) return reply('❌ Give a text or reply to an image / video / audio.\n\nExample: .gstatus Hello everyone');

        await postGroupStatus(conn, target, content);
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        reply(`✅ Group status posted.\n\n${config.DESCRIPTION}`);
    } catch (e) {
        console.error('gstatus error:', e);
        reply(`❌ Could not post group status: ${e.message}`);
    }
});
