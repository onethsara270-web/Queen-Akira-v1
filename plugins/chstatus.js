// plugins/chstatus.js
const { downloadContentFromMessage } = require('fixo-baileys');
const config = require('../config');
const { cmd } = require('../command');

const BOT_NAME = "Queen Zara";
const MAIN_CHANNEL = config.NEWSLETTER_JID || '120363409660898486@newsletter';

// Helper: Link එකකින් හරි JID එකකින් හරි Channel ID එක ගන්නවා
async function resolveChannel(conn, input) {
    if (!input) return null;
    if (input.endsWith('@newsletter')) return input;

    const link = input.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)/);
    if (link) {
        try {
            const meta = await conn.newsletterMetadata('invite', link[1]);
            return meta?.id || null;
        } catch { return null; }
    }
    const digits = input.replace(/[^0-9]/g, '');
    return digits ? `${digits}@newsletter` : null;
}

// Helper: Text හෝ Media Status එකක් හදනවා
async function buildContent(m, text) {
    const ctx = m.message?.extendedTextMessage?.contextInfo || {};
    const quoted = ctx.quotedMessage;
    
    // Reply කරපුවා view-once නම් ඒක අයින් කරලා ගන්නවා
    const actual = quoted?.viewOnceMessageV2?.message 
                || quoted?.viewOnceMessage?.message 
                || quoted;

    if (actual) {
        const vType = Object.keys(actual)[0];
        const mediaKey = vType?.replace('Message', '');

        if (['imageMessage', 'videoMessage', 'audioMessage'].includes(vType)) {
            try {
                const stream = await downloadContentFromMessage(actual[vType], mediaKey);
                const chunks = [];
                for await (const c of stream) chunks.push(c);
                const buffer = Buffer.concat(chunks);
                
                if (!buffer.length) return text ? { text, backgroundColor: '#FFC107', font: 2 } : null;

                if (vType === 'imageMessage') return { image: buffer, caption: text || '' };
                if (vType === 'videoMessage') return { video: buffer, caption: text || '' };
                if (vType === 'audioMessage') return { audio: buffer, mimetype: 'audio/mp4', ptt: false };
            } catch (e) {
                console.error('[chstatus] media error:', e.message);
            }
        }
    }

    // Text Status (WhatsApp Status එකකට background color එකක් අනිවාර්යයි)
    if (text) {
        return { 
            text: text, 
            backgroundColor: '#FFC107', // ඔයාගේ screenshot එකේ වගේ කහ පාට
            font: 2 
        };
    }
    return null;
}

// Main Command
cmd({
    pattern: "chstatus",
    alias: ["cstatus", "channelstatus"],
    use: '.chstatus [text] | reply to media',
    desc: "Post a native WhatsApp Channel Status",
    category: "owner",
    react: "📢",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isCreator, isOwner }) => {

    // Owner check
    if (!isCreator && !isOwner) {
        await conn.sendMessage(from, { react: { text: '⛔', key: mek.key } }).catch(() => {});
        return reply('❌ *Owner only command.*');
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        let targetJid = MAIN_CHANNEL;
        let text = (q || '').trim();
        const parts = text.split(/\s+/);

        // ඔයා link එකක් දීලා නම් ඒක අයින් කරලා JID එක ගන්නවා
        if (parts[0] && (parts[0].includes('whatsapp.com/channel/') || parts[0].endsWith('@newsletter'))) {
            const resolved = await resolveChannel(conn, parts[0]);
            if (resolved) {
                targetJid = resolved;
                text = parts.slice(1).join(' '); 
            }
        }

        // Content එක හදනවා
        const content = await buildContent(m, text);
        if (!content) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('❌ *Text එකක් දෙන්න නැත්නම් මොකක් හරි image/video එකකට reply කරලා මේක ගහන්න.*');
        }

        // Status එක යවන විදිහ (Fallback නැතුව)
        let sent = false;
        if (typeof conn.sendChannelStatus === 'function') {
            try {
                await conn.sendChannelStatus(targetJid, content);
                sent = true;
            } catch (e) {
                console.error('[chstatus] sendChannelStatus failed:', e.message);
            }
        }

        // ඔයාගේ library එකේ sendChannelStatus නැත්නම් හරි, ඒකෙන් අවුලක් ආවොත් හරි, 
        // අපි කෙලින්ම status විදිහට force කරලා යවනවා.
        if (!sent) {
            await conn.sendMessage(targetJid, content, { isStatus: true });
        }

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
        return reply(`📢 *Successfully posted Channel Status to:*\n📌 ${targetJid}`);

    } catch (e) {
        console.error('[chstatus]', e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Failed to post status:*\n_${e.message}_`);
    }
});
