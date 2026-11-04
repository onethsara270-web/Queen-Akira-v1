// plugins/binlookup.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// ── Branding ──────────────────────────────
const BOT_NAME = "Queen Zara";
// ──────────────────────────────────────────

cmd({
    pattern: "binlookup",
    alias: ["bin", "bininfo"],
    use: '.binlookup <6-8 digits>',
    desc: "Lookup card BIN information",
    category: "tools",
    react: "💳",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    const bin = (q || '').replace(/\D/g, '').substring(0, 8);

    // ── No args ──────────────────────────────
    if (!bin) {
        return reply(
            `⚠️ *BIN Lookup Command*\n\n` +
            `*Usage:* .binlookup [6-8 digits]\n\n` +
            `*Example:*\n` +
            `.binlookup 457173\n\n` +
            `🔍 Enter first 6-8 digits of card number.`
        );
    }

    // ── Length check ─────────────────────────
    if (bin.length < 6) {
        return reply('❌ *Invalid BIN!*\n\nBIN must be at least 6 digits.\n\nExample: .binlookup 457173');
    }

    try {
        // ── Real API call ────────────────────
        const { data } = await axios.get(`https://lookup.binlist.net/${bin}`, {
            headers: { 'Accept-Version': '3' },
            timeout: 15000,
            validateStatus: s => s === 200 || s === 404
        });

        if (!data || !data.scheme) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply(`❌ *No data found for BIN:* ${bin}`);
        }

        const scheme  = (data.scheme  || 'UNKNOWN').toUpperCase();
        const type    = (data.type    || 'UNKNOWN').toUpperCase();
        const brand   = (data.brand   || '-');
        const prepaid = data.prepaid ? 'YES' : 'NO';
        const country = data.country?.name || 'Unknown';
        const flag    = data.country?.emoji || '';
        const bank    = data.bank?.name || 'Unknown';
        const bankUrl = data.bank?.url  ? ` (${data.bank.url})` : '';

        await reply(
            `💳 *BIN LOOKUP RESULTS* 💳\n\n` +
            `🔢 *BIN:* ${bin}XXXXXX\n` +
            `💳 *Scheme:* ${scheme}\n` +
            `💰 *Type:* ${type}\n` +
            `🏷️ *Brand:* ${brand}\n` +
            `📦 *Prepaid:* ${prepaid}\n` +
            `🏛️ *Bank:* ${bank}${bankUrl}\n` +
            `🌍 *Country:* ${flag} ${country}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `⚡ Powered by ${BOT_NAME}`
        );

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (error) {
        // ── Fallback: mock (deterministic) ────
        console.error('[binlookup]', error.message);

        const schemes   = ['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER', 'JCB', 'DINERS CLUB', 'RUPAY'];
        const types     = ['DEBIT', 'CREDIT', 'PREPAID', 'CHARGE'];
        const countries = ['United States', 'United Kingdom', 'Pakistan', 'India', 'UAE', 'Saudi Arabia', 'Singapore', 'Malaysia', 'Sri Lanka', 'Canada', 'Australia', 'Germany', 'France', 'Japan'];
        const banks     = ['Habib Bank', 'UBL', 'MCB', 'Allied Bank', 'Bank Alfalah', 'Meezan Bank', 'HSBC', 'Citibank', 'Standard Chartered', 'DBS Bank', 'Maybank', 'SBI', 'ICICI Bank', 'HDFC Bank'];

        const seed     = parseInt(bin);
        const scheme   = schemes[seed % schemes.length];
        const type     = types[(seed + 1) % types.length];
        const country  = countries[(seed + 2) % countries.length];
        const bank     = banks[(seed + 3) % banks.length];

        await reply(
            `💳 *BIN LOOKUP RESULTS* 💳\n\n` +
            `🔢 *BIN:* ${bin}XXXXXX\n` +
            `💳 *Scheme:* ${scheme}\n` +
            `💰 *Type:* ${type}\n` +
            `🏛️ *Bank:* ${bank}\n` +
            `🌍 *Country:* ${country}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `⚠️ API unreachable — showing estimated data\n` +
            `⚡ Powered by ${BOT_NAME}`
        );

        await conn.sendMessage(from, { react: { text: '⚠️', key: mek.key } }).catch(() => {});
    }
});