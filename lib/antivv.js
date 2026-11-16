// lib/antivv.js
// 🛡️ ANTI VIEW-ONCE — captures view-once media and forwards to the bot's own chat
const { downloadContentFromMessage, getContentType, jidNormalizedUser } = require('fixo-baileys');

async function AntiViewOnce(conn, mek) {
    try {
        const cfg = conn._userConfig || {};
        if (String(cfg.ANTI_VV) !== 'true') return false;
        if (!mek || !mek.message) return false;
        if (mek.key.fromMe) return false;

        const wrapType = getContentType(mek.message);
        const isV2 = wrapType === 'viewOnceMessageV2' || wrapType === 'viewOnceMessageV2Extension';
        const isV1 = wrapType === 'viewOnceMessage';
        if (!isV2 && !isV1) return false;

        const inner = isV1
            ? (mek.message.viewOnceMessage?.message || {})
            : (mek.message[wrapType]?.message || {});
        const innerType = getContentType(inner);
        if (!innerType) return false;

        const mediaMsg = inner[innerType];
        if (!mediaMsg) return false;

        const mediaType = innerType.replace('Message', ''); // image | video | audio
        const supported = ['image', 'video', 'audio'];
        if (!supported.includes(mediaType)) return false;

        const stream = await downloadContentFromMessage(mediaMsg, mediaType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        if (!buffer.length) return false;

        const sender = mek.key.participant || mek.key.remoteJid || '';
        const senderNumber = String(sender).split('@')[0];
        const chat = mek.key.remoteJid || '';
        const isGroup = chat.endsWith('@g.us');
        const botJid = jidNormalizedUser(conn.user.id);

        const caption =
            `🛡️ *ANTI VIEW-ONCE*\n\n` +
            `📤 *From:* @${senderNumber}\n` +
            `💬 *Chat:* ${isGroup ? 'Group' : 'Direct'}\n` +
            `📎 *Type:* ${mediaType.toUpperCase()}`;

        const sendContent = { caption, mentions: [sender] };
        if (mediaType === 'image') sendContent.image = buffer;
        else if (mediaType === 'video') sendContent.video = buffer;
        else if (mediaType === 'audio') { sendContent.audio = buffer; sendContent.mimetype = 'audio/mp4'; }

        await conn.sendMessage(botJid, sendContent, { quoted: mek });
        console.log(`🛡️ [ANTI_VV] Captured ${mediaType} from ${senderNumber}`);
        return true;
    } catch (e) {
        console.error('❌ AntiViewOnce:', e.message);
        return false;
    }
}

module.exports = { AntiViewOnce };
