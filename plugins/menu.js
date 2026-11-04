// ============================================================
// 📋 MENU — swipeable category cards (image + numbered command list + OPEN button)
//   .menu            -> carousel with one card per category
//   .menu <category> -> the commands of that category (the card's OPEN button sends this)
// Built from every registered command, so a new plugin shows up automatically.
// ============================================================
const { cmd, commands } = require('../command');
const config = require('../config');
const { runtime } = require('../lib/functions');
const { imageSource, getImageBuffer } = require('../lib/media');

const CAT_ICONS = {
    main: '🏠', owner: '👑', group: '👥', channel: '📡', download: '📥', downloader: '📥',
    convert: '🔄', ai: '🤖', fun: '🎉', search: '🔍', tools: '🛠️', misc: '📦', other: '📦'
};
const LINE = '≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋';
const MAX_CARDS = 10;

function collect() {
    const cats = {};
    for (const c of commands) {
        if (!c.pattern || c.dontAddCommandList || c.on) continue;
        const cat = String(c.category || 'misc').toLowerCase();
        const list = (cats[cat] = cats[cat] || []);
        if (!list.includes(c.pattern)) list.push(c.pattern);
    }
    for (const k of Object.keys(cats)) cats[k].sort();
    return cats;
}

function cardText(cat, list, prefix) {
    const icon = CAT_ICONS[cat] || '📁';
    const rows = list.map((p, i) => `≋ ${String(i + 1).padStart(2, '0')}  ${prefix}${p}`).join('\n');
    return `${icon} ${cat.toUpperCase()}\n\n${LINE}\n${rows}\n${LINE}`;
}

async function sendCarousel(conn, from, mek, headerText, cards) {
    const { generateWAMessageFromContent, prepareWAMessageMedia, proto } = require('fixo-baileys');
    const buf = await getImageBuffer(config.ALIVE_IMG);
    if (!buf) throw new Error('menu image could not be downloaded');
    const IM = proto.Message.InteractiveMessage;
    const media = await prepareWAMessageMedia({ image: buf }, { upload: conn.waUploadToServer });

    const cardObjs = cards.map(c => ({
        header: IM.Header.fromObject({ imageMessage: media.imageMessage, hasMediaAttachment: true }),
        body: IM.Body.fromObject({ text: c.body }),
        footer: IM.Footer.fromObject({ text: c.footer }),
        nativeFlowMessage: IM.NativeFlowMessage.fromObject({
            buttons: [{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'OPEN', id: c.id }) }]
        })
    }));

    const msg = generateWAMessageFromContent(from, {
        viewOnceMessage: {
            message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage: IM.fromObject({
                    body: { text: headerText },
                    footer: { text: config.DESCRIPTION },
                    carouselMessage: IM.CarouselMessage.fromObject({ cards: cardObjs, messageVersion: 1 })
                })
            }
        }
    }, { quoted: mek, userJid: conn.user && conn.user.id });
    await conn.relayMessage(from, msg.message, { messageId: msg.key.id });
}

cmd({
    pattern: 'menu',
    alias: ['help', 'list', 'cmds'],
    desc: 'Show the command menu',
    category: 'main',
    react: '📋',
    filename: __filename
},
async (conn, mek, m, { from, sender, pushname, isGroup, q, reply }) => {
    try {
        const prefix = config.PREFIX || '.';
        const botName = config.BOT_NAME;
        const userName = pushname || sender.split('@')[0];
        const cats = collect();
        const contextInfo = { mentionedJid: [sender], forwardingScore: 999, isForwarded: true };
        if (!isGroup) {
            contextInfo.forwardedNewsletterMessageInfo = {
                newsletterJid: config.NEWSLETTER_JID,
                newsletterName: config.NEWSLETTER_NAME || botName,
                serverMessageId: 143
            };
        }

        // ── .menu <category> ──────────────────────────────────
        const want = String(q || '').trim().toLowerCase();
        if (want) {
            const key = Object.keys(cats).find(k => k === want);
            if (!key) return reply(`❌ No category "${want}".\n\nCategories: ${Object.keys(cats).join(', ')}`);
            return await conn.sendMessage(from, {
                image: await imageSource(config.ALIVE_IMG),
                caption: `${cardText(key, cats[key], prefix)}\n\n${config.DESCRIPTION}`,
                contextInfo
            }, { quoted: mek });
        }

        // ── .menu (carousel) ──────────────────────────────────
        const header =
`👋 𝙷𝙴𝙻𝙻𝙾𝚆 *${userName}* 𝚆𝙴𝙻𝙲𝙾𝙼𝙴 𝚃𝙾 ${botName} 🎉

 ╭─「 ɪɴꜰᴏ 」 ──●●►
 │  ⏳ *Uptime*  : ${runtime(process.uptime())}
 │  🔣 *Prefix*  : ${prefix}
 │  👨‍💻 *Owner*   : ${config.OWNER_NAME}
 │  🧬 *Version* : 3.0.0 BETA
 ╰───────────●●►

👉 Swipe the cards and press *OPEN*`;

        const names = Object.keys(cats).sort((a, b) => (a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b))).slice(0, MAX_CARDS);
        const cards = names.map(cat => ({
            body: cardText(cat, cats[cat], prefix),
            footer: `${botName} OFFICIAL WA BOT`,
            id: `${prefix}menu ${cat}`
        }));

        try {
            await sendCarousel(conn, from, mek, header, cards);
        } catch (e) {
            // carousel not supported / failed -> plain menu with the same numbered style
            console.log('⚠️ carousel menu failed, sending text menu:', e.message);
            let body = '';
            for (const cat of names) body += `\n${cardText(cat, cats[cat], prefix)}\n`;
            const msg = { image: await imageSource(config.ALIVE_IMG), caption: `${header}\n${body}\n${config.DESCRIPTION}`, ai: !isGroup, contextInfo };
            if (String(config.BUTTON).toLowerCase() === 'true') {
                msg.footer = '🔘 Select an option below';
                msg.headerType = 1;
                msg.buttons = [
                    { buttonId: `${prefix}alive`, buttonText: { displayText: '💚 Alive' }, type: 1 },
                    { buttonId: `${prefix}ping`, buttonText: { displayText: '🏓 Ping' }, type: 1 },
                    { buttonId: `${prefix}owner`, buttonText: { displayText: '👤 Owner' }, type: 1 }
                ];
            }
            await conn.sendMessage(from, msg, { quoted: mek });
        }
    } catch (e) {
        console.error('menu error:', e);
        reply(`An error occurred: ${e.message}`);
    }
});
