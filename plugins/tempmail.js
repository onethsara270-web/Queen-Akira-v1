// plugins/tempmail.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME        = "Queen Zara";
const MAIL_API        = 'https://api.mail.tm';
const SESSION_TTL_MS  = 10 * 60 * 1000;   // 10 min
const CHECK_INTERVAL  = 15000;            // 15s
// ─────────────────────────────────────────

// Module-level sessions survive until restart (temp storage)
const sessions = {};

// ── API helpers ───────────────────────────
async function createAccount() {
    const { data: dom } = await axios.get(`${MAIL_API}/domains`, { timeout: 15000 });
    const domain = dom['hydra:member']?.[0]?.domain;
    if (!domain) throw new Error('no domain available');

    const local   = Math.random().toString(36).slice(2, 10);
    const address = `${local}@${domain}`;
    const password = Math.random().toString(36).slice(2, 15);

    await axios.post(`${MAIL_API}/accounts`, { address, password }, { timeout: 15000 });
    const { data: tok } = await axios.post(`${MAIL_API}/token`, { address, password }, { timeout: 15000 });

    return { email: address, token: tok.token };
}

async function checkMessages(token) {
    try {
        const { data } = await axios.get(`${MAIL_API}/messages`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000
        });
        return data['hydra:member'] || [];
    } catch (e) {
        // 401 = token invalid (mailbox expired)
        if (e.response?.status === 401) throw new Error('TOKEN_EXPIRED');
        return [];
    }
}

async function getMessage(token, id) {
    try {
        const { data } = await axios.get(`${MAIL_API}/messages/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000
        });
        return data;
    } catch { return null; }
}

// ── Format a mail ─────────────────────────
function formatMail(fullMsg, header = '📧 *NEW EMAIL*') {
    const text = fullMsg.text || fullMsg.intro || '';
    const otpMatch = text.match(/\b\d{4,8}\b/);
    const otp = otpMatch ? otpMatch[0] : null;

    const body = (fullMsg.intro || text.substring(0, 500) || 'No content').trim();

    return (
        `${header}\n\n` +
        `📨 *From:* ${fullMsg.from?.address || 'Unknown'}\n` +
        `📌 *Subject:* ${fullMsg.subject || '(No Subject)'}\n` +
        `🕐 *Time:* ${new Date(fullMsg.createdAt).toLocaleString()}\n\n` +
        (otp ? `🔐 *OTP:* \`${otp}\`\n\n` : '') +
        `📝 *Content:*\n${body}\n\n` +
        `⚡ Powered by ${BOT_NAME}`
    );
}

// ── Fetch new mails + forward ─────────────
async function fetchAndForward(sock, chatId, session) {
    let messages;
    try { messages = await checkMessages(session.token); }
    catch (e) {
        if (e.message === 'TOKEN_EXPIRED') return { expired: true };
        return { messages: [] };
    }

    const fresh = messages.filter(m => !session.seenMessages.includes(m.id));

    for (const mail of fresh) {
        const full = await getMessage(session.token, mail.id);
        if (!full) continue;
        try {
            await sock.sendMessage(chatId, { text: formatMail(full) });
            session.seenMessages.push(mail.id);
        } catch (e) {
            console.error('[tempmail] forward:', e.message);
        }
    }

    return { messages, newCount: fresh.length };
}

// ── Session cleanup ───────────────────────
function stopSession(userId) {
    const s = sessions[userId];
    if (!s) return;
    if (s.interval) clearInterval(s.interval);
    delete sessions[userId];
}

// ── Auto-checker ──────────────────────────
function startChecker(sock, chatId, userId) {
    const s = sessions[userId];
    if (!s) return;
    if (s.interval) clearInterval(s.interval);

    s.interval = setInterval(async () => {
        const live = sessions[userId];
        if (!live) return clearInterval(s.interval);

        // TTL expired
        if (Date.now() - live.createdAt > SESSION_TTL_MS) {
            stopSession(userId);
            try {
                await sock.sendMessage(chatId, {
                    text: '⏰ *Tempmail session expired.*\n\nUse `.tempmail` to create a new one.'
                });
            } catch {}
            return;
        }

        try {
            const res = await fetchAndForward(sock, chatId, live);
            if (res.expired) {
                stopSession(userId);
                try {
                    await sock.sendMessage(chatId, {
                        text: '⏰ *Mailbox expired server-side.*\n\nUse `.tempmail` to create a new one.'
                    });
                } catch {}
            }
        } catch (e) {
            console.error('[tempmail] checker:', e.message);
        }
    }, CHECK_INTERVAL);
}

// ── Main command ──────────────────────────
cmd({
    pattern: "tempmail",
    alias: ["temp", "tmpmail", "mail"],
    use: '.tempmail [delete|refresh]',
    desc: "Create and check a temporary email inbox",
    category: "tools",
    react: "📧",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    const userId = from;
    const action = (q || '').trim().toLowerCase();

    try {
        // ── DELETE ──────────────────────────
        if (action === 'delete' || action === 'stop') {
            if (!sessions[userId]) {
                return reply('❌ *No active tempmail to delete.*');
            }
            stopSession(userId);
            await conn.sendMessage(from, { react: { text: '🗑️', key: mek.key } }).catch(() => {});
            return reply('🗑️ *Tempmail session deleted.*');
        }

        // ── REFRESH ─────────────────────────
        if (action === 'refresh' || action === 'new') {
            stopSession(userId);
            // fall through to create new account below
        }

        // ── Active session? ─────────────────
        if (sessions[userId] && action !== 'refresh' && action !== 'new') {
            const s = sessions[userId];

            if (Date.now() - s.createdAt > SESSION_TTL_MS) {
                stopSession(userId);
                return reply('⏰ *Session expired.* Use `.tempmail` to create a new one.');
            }

            const res = await fetchAndForward(conn, from, s);
            if (res.expired) {
                stopSession(userId);
                return reply('⏰ *Mailbox expired server-side.* Use `.tempmail` to create a new one.');
            }

            const remainingMs = SESSION_TTL_MS - (Date.now() - s.createdAt);
            const minutes = Math.ceil(remainingMs / 60000);

            await reply(
                `📧 *TEMP MAIL ACTIVE*\n\n` +
                `📩 *Email:*\n\`${s.email}\`\n\n` +
                `📨 *Total:* ${res.messages?.length || 0}\n` +
                `🔔 *New:* ${res.newCount || 0}\n` +
                `⏳ *Valid for:* ${minutes} min\n\n` +
                `*Commands:*\n` +
                `.tempmail — check inbox\n` +
                `.tempmail refresh — new email\n` +
                `.tempmail delete — stop session`
            );
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
            return;
        }

        // ── Create new ──────────────────────
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        const account = await createAccount();

        sessions[userId] = {
            email:        account.email,
            token:        account.token,
            createdAt:    Date.now(),
            seenMessages: [],
            interval:     null
        };

        await reply(
            `📧 *TEMP MAIL CREATED*\n\n` +
            `✅ *Email:*\n\`${account.email}\`\n\n` +
            `⏳ *Valid for:* 10 minutes\n` +
            `🔔 *Auto-check:* every 15s\n\n` +
            `*Commands:*\n` +
            `.tempmail — check inbox\n` +
            `.tempmail refresh — new email\n` +
            `.tempmail delete — stop session`
        );

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

        startChecker(conn, from, userId);

    } catch (e) {
        console.error('[tempmail]', e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *Error:* ${e.message}`);
    }
});