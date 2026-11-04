// plugins/kickoffline.js
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME         = "Queen Zara";
const INACTIVE_DAYS    = 15;
const INACTIVE_MS      = INACTIVE_DAYS * 24 * 60 * 60 * 1000;
const TRACK_MIN_MS     = 60 * 1000;   // 1 min — avoid writing every message
// ─────────────────────────────────────────

function nowMs() { return Date.now(); }

function ensureStore(botData) {
    if (!botData.kickOffline)        botData.kickOffline = {};
    if (!botData.activity)           botData.activity = {};   // { group: { user: ts } }
    if (!botData.activityStartedAt)  botData.activityStartedAt = {};
    if (!botData.activityFirstSeen)  botData.activityFirstSeen = {};
}

cmd({
    pattern: "kickoffline",
    alias: ["ko", "inactivekick"],
    use: '.kickoffline <on|off|check|reset>',
    desc: "Track and kick inactive members (admin only)",
    category: "group",
    react: "💤",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isGroup, isAdmin, isCreator, isOwner, botData, saveBotData }) => {

    if (!isGroup) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *This command only works in groups.*');
    }
    if (!isAdmin && !isCreator && !isOwner) {
        await conn.sendMessage(from, { react: { text: '⛔', key: mek.key } }).catch(() => {});
        return reply('❌ *Only admins can use this command.*');
    }

    ensureStore(botData);

    const action = (q || '').trim().toLowerCase().split(/\s+/)[0];

    // ── ON / OFF ─────────────────────────
    if (action === 'on') {
        botData.kickOffline[from] = true;
        if (!botData.activityStartedAt[from]) botData.activityStartedAt[from] = nowMs();
        saveBotData?.();
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
        return reply(
            `✅ *Kick-Offline ENABLED*\n\n` +
            `Members with no tracked activity for *${INACTIVE_DAYS} days* ` +
            `will be removed when you run *.kickoffline check*.\n\n` +
            `⚠️ *Note:* The bot only sees messages sent while it's online. ` +
            `Members who only chat while the bot is offline won't be tracked.`
        );
    }

    if (action === 'off') {
        botData.kickOffline[from] = false;
        saveBotData?.();
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *Kick-Offline disabled.*');
    }

    if (action === 'reset') {
        delete botData.activity[from];
        delete botData.activityStartedAt[from];
        saveBotData?.();
        await conn.sendMessage(from, { react: { text: '♻️', key: mek.key } }).catch(() => {});
        return reply('♻️ *Activity tracking reset for this group.*');
    }

    if (action === 'check') {
        if (!botData.kickOffline[from]) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('❌ *Kick-Offline is OFF.* Enable it with `.kickoffline on` first.');
        }

        try {
            await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

            // ── Bot admin check ──────────
            const meta = await conn.groupMetadata(from);
            const botId = conn.user?.id?.split(':')[0] + '@s.whatsapp.net';
            const botP  = meta.participants.find(p => p.id === botId);
            const botAdmin = botP?.admin === 'admin' || botP?.admin === 'superadmin';

            if (!botAdmin) {
                await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
                return reply('❌ *I need to be an admin to kick members.*');
            }

            // ── Build kick list ──────────
            const actStart = botData.activityStartedAt[from] || nowMs();
            const groupAct = botData.activity[from] || {};
            const groupOwner = meta.owner || meta.subjectOwner ||
                meta.participants.find(p => p.admin === 'superadmin')?.id;

            const toKick  = [];
            const tooNew  = [];     // tracking not long enough yet
            const unknown = [];     // never seen a message

            for (const p of meta.participants) {
                if (p.id === botId)         continue;
                if (p.id === groupOwner)    continue;
                if (p.admin)                continue;

                const lastSeen = groupAct[p.id];

                if (lastSeen) {
                    if (nowMs() - lastSeen >= INACTIVE_MS) toKick.push(p.id);
                } else {
                    // never tracked — if tracking started <15 days ago, can't judge yet
                    if (nowMs() - actStart < INACTIVE_MS) tooNew.push(p.id);
                    else unknown.push(p.id);
                }
            }

            if (!toKick.length && !unknown.length) {
                await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
                const waitDays = Math.ceil((INACTIVE_MS - (nowMs() - actStart)) / (24 * 60 * 60 * 1000));
                return reply(
                    `✅ *No inactive members to kick right now.*\n\n` +
                    `⏳ *Tracking started:* ${Math.floor((nowMs() - actStart) / (24 * 60 * 60 * 1000))} days ago\n` +
                    (waitDays > 0 ? `📌 *Need ${waitDays} more days before judging untracked members.*\n\n` : '\n') +
                    `⚡ Powered by ${BOT_NAME}`
                );
            }

            // Kick those who exceeded threshold
            let kicked = 0, failed = 0;
            for (const jid of toKick) {
                try {
                    await conn.groupParticipantsUpdate(from, [jid], 'remove');
                    kicked++;
                    delete botData.activity[from][jid];
                } catch (e) {
                    failed++;
                    console.error(`[kickoffline] ${jid}:`, e.message);
                }
            }

            saveBotData?.();

            const lines = [
                `💤 *KICK-OFFLINE REPORT*`,
                ``,
                `✅ *Kicked:* ${kicked}`,
                `❌ *Failed:* ${failed}`,
                `⏳ *Too new to judge:* ${tooNew.length}`
            ];
            if (unknown.length) {
                lines.push(`❓ *Untracked (never seen):* ${unknown.length}`);
                lines.push(`_Run again tomorrow — they'll still be untracked if truly inactive._`);
            }
            lines.push(``);
            lines.push(`⚡ Powered by ${BOT_NAME}`);

            await reply(lines.join('\n'));
            await conn.sendMessage(from, { react: { text: kicked ? '✅' : '⚠️', key: mek.key } }).catch(() => {});

        } catch (e) {
            console.error('[kickoffline] check:', e);
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply(`❌ *Error:* ${e.message}`);
        }
        return;
    }

    // ── No valid action ─────────────────────
    await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
    return reply(
        `💤 *Kick-Offline*\n\n` +
        `*Usage:*\n` +
        `.kickoffline on      — enable tracking\n` +
        `.kickoffline off     — disable\n` +
        `.kickoffline check   — kick inactive members now\n` +
        `.kickoffline reset   — clear activity data for this group\n\n` +
        `⚡ Powered by ${BOT_NAME}`
    );
});