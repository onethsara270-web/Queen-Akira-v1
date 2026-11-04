// plugins/kick.js
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME = "Queen Zara";
// ─────────────────────────────────────────

cmd({
    pattern: "kick",
    alias: ["remove", "boot"],
    use: '.kick @user | reply',
    desc: "Remove a member from the group (admin only)",
    category: "group",
    react: "👢",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, isAdmin, isCreator, isOwner, mentionedJid }) => {

    // ── Group only ──────────────────────────
    if (!isGroup) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply('❌ *This command can only be used in groups.*');
    }

    // ── Admin / owner only ──────────────────
    if (!isAdmin && !isCreator && !isOwner) {
        await conn.sendMessage(from, { react: { text: '⛔', key: mek.key } }).catch(() => {});
        return reply('❌ *Only admins can use this command.*');
    }

    try {
        // ── Bot must be admin ────────────────
        const meta = await conn.groupMetadata(from);
        const botId = conn.user?.id?.split(':')[0] + '@s.whatsapp.net';
        const botParticipant = meta.participants.find(p => p.id === botId);

        if (!botParticipant || (botParticipant.admin !== 'admin' && botParticipant.admin !== 'superadmin')) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('❌ *I need to be an admin to kick members.*');
        }

        // ── Resolve targets ──────────────────
        const ctx = m.message?.extendedTextMessage?.contextInfo || {};
        let targets =
            (mentionedJid && mentionedJid.length ? mentionedJid : null) ||
            (ctx.mentionedJid && ctx.mentionedJid.length ? ctx.mentionedJid : null) ||
            (ctx.participant ? [ctx.participant] : []);

        if (!targets.length) {
            await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
            return reply('❌ *Please reply to a message or tag someone to kick.*');
        }

        // ── Filter: don't kick bot / owner / admins ──
        const groupOwner = meta.owner || meta.subjectOwner ||
            meta.participants.find(p => p.admin === 'superadmin')?.id;

        const adminIds = new Set(
            meta.participants
                .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                .map(p => p.id)
        );

        const skipped = [];
        targets = targets.filter(id => {
            if (id === botId)          { skipped.push(id); return false; }
            if (id === groupOwner)     { skipped.push(id); return false; }
            if (adminIds.has(id))      { skipped.push(id); return false; }
            return true;
        });

        if (!targets.length) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply('❌ *Cannot kick bot, group owner, or other admins.*');
        }

        // ── Kick ─────────────────────────────
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        let kicked = 0;
        let failed = 0;

        for (const jid of targets) {
            try {
                await conn.groupParticipantsUpdate(from, [jid], 'remove');
                kicked++;
            } catch (e) {
                failed++;
                console.error(`[kick] ${jid}:`, e.message);
            }
        }

        // ── Report ───────────────────────────
        let report =
            `👢 *KICK RESULT*\n\n` +
            `✅ *Kicked:* ${kicked}\n` +
            `❌ *Failed:* ${failed}`;

        if (skipped.length) {
            report += `\n⏭️ *Skipped:* ${skipped.length} (bot/owner/admin)`;
        }

        report += `\n\n⚡ Powered by ${BOT_NAME}`;

        await reply(report);
        await conn.sendMessage(from, { react: { text: kicked ? '✅' : '❌', key: mek.key } }).catch(() => {});

    } catch (e) {
        console.error('[kick]', e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Failed to kick user:* ${e.message}`);
    }
});