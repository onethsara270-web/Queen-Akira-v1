// plugins/dnslookup.js
const dns = require('dns').promises;
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME = "Queen Zara";
const MAX_LEN  = 58000;   // WhatsApp safe margin
// ─────────────────────────────────────────

cmd({
    pattern: "dnslookup",
    alias: ["dns", "dig"],
    use: '.dnslookup <domain>',
    desc: "Get DNS records for a domain",
    category: "tools",
    react: "📡",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    const domain = (q || '').trim().toLowerCase();
    if (!domain) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(
            `📡 *DNS Lookup Tool*\n\n` +
            `📌 *Usage:* .dnslookup [domain]\n\n` +
            `📝 *Example:* .dnslookup google.com`
        );
    }

    // ── Status ───────────────────────────────
    let statusMsg;
    try {
        statusMsg = await conn.sendMessage(from, {
            text: `📡 *Looking up DNS for:* ${domain}\n\n⏳ Please wait...`
        }, { quoted: mek });
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});
    } catch (e) {
        console.error('[dns] status', e.message);
    }

    try {
        // ── Parallel lookups ─────────────────
        const [aR, aaaaR, mxR, txtR, nsR, soaR] = await Promise.allSettled([
            dns.resolve4(domain).catch(() => []),
            dns.resolve6(domain).catch(() => []),
            dns.resolveMx(domain).catch(() => []),
            dns.resolveTxt(domain).catch(() => []),
            dns.resolveNs(domain).catch(() => []),
            dns.resolveSoa(domain).catch(() => null)
        ]);

        // ── Format ───────────────────────────
        const lines = [];
        lines.push(`📡 *DNS Lookup Results*`);
        lines.push(`🌐 *Domain:* ${domain}`);
        lines.push('');

        // A
        lines.push(`🌍 *A Records (IPv4):*`);
        const a = aR.status === 'fulfilled' ? aR.value : [];
        if (a.length) a.forEach(ip => lines.push(`  • ${ip}`));
        else lines.push('  ❌ None');
        lines.push('');

        // AAAA
        lines.push(`🌍 *AAAA Records (IPv6):*`);
        const aaaa = aaaaR.status === 'fulfilled' ? aaaaR.value : [];
        if (aaaa.length) aaaa.forEach(ip => lines.push(`  • ${ip}`));
        else lines.push('  ❌ None');
        lines.push('');

        // MX
        lines.push(`📧 *MX Records:*`);
        const mx = mxR.status === 'fulfilled' ? mxR.value : [];
        if (mx.length) {
            mx.sort((x, y) => x.priority - y.priority);
            mx.forEach(r => lines.push(`  • ${r.exchange} (Priority: ${r.priority})`));
        } else lines.push('  ❌ None');
        lines.push('');

        // TXT
        lines.push(`📋 *TXT Records:*`);
        const txt = txtR.status === 'fulfilled' ? txtR.value : [];
        if (txt.length) {
            txt.forEach(rec => {
                const s = Array.isArray(rec) ? rec.join('') : rec;
                lines.push(`  • ${s.length > 100 ? s.slice(0, 100) + '...' : s}`);
            });
        } else lines.push('  ❌ None');
        lines.push('');

        // NS
        lines.push(`🌐 *NS Records:*`);
        const ns = nsR.status === 'fulfilled' ? nsR.value : [];
        if (ns.length) ns.forEach(n => lines.push(`  • ${n}`));
        else lines.push('  ❌ None');
        lines.push('');

        // SOA
        lines.push(`📋 *SOA Record:*`);
        const soa = soaR.status === 'fulfilled' ? soaR.value : null;
        if (soa) {
            lines.push(`  • Primary NS: ${soa.nsname}`);
            lines.push(`  • Email: ${soa.hostmaster}`);
            lines.push(`  • Serial: ${soa.serial}`);
            lines.push(`  • Refresh: ${soa.refresh}`);
            lines.push(`  • Retry: ${soa.retry}`);
            lines.push(`  • Expire: ${soa.expire}`);
            lines.push(`  • TTL: ${soa.ttl}`);
        } else lines.push('  ❌ None');

        lines.push('');
        lines.push(`⚡ Powered by ${BOT_NAME}`);

        const full = lines.join('\n');

        // ── Safe split on newlines ────────────
        if (full.length > MAX_LEN) {
            const chunks = [];
            let cur = '';
            for (const line of lines) {
                if ((cur + '\n' + line).length > MAX_LEN) {
                    chunks.push(cur);
                    cur = line;
                } else {
                    cur = cur ? cur + '\n' + line : line;
                }
            }
            if (cur) chunks.push(cur);
            for (const c of chunks) await conn.sendMessage(from, { text: c }, { quoted: mek });
        } else {
            await conn.sendMessage(from, { text: full }, { quoted: mek });
        }

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (error) {
        console.error('[dns]', error);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        await reply(`❌ *DNS Error:* ${error.message}\n\nPlease check the domain name and try again.`);
    }

    // ── Cleanup ──────────────────────────────
    if (statusMsg) {
        await new Promise(r => setTimeout(r, 2000));
        await conn.sendMessage(from, { delete: statusMsg.key }).catch(() => {});
    }
});