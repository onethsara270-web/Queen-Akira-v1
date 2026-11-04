// plugins/npm.js
const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME = "Queen Zara";
// ─────────────────────────────────────────

cmd({
    pattern: "npm",
    alias: ["npmpkg", "npminfo"],
    use: '.npm <package name>',
    desc: "Lookup npm package information",
    category: "tools",
    react: "📦",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

    const pkgName = (q || '').trim().split(/\s+/)[0];
    if (!pkgName) {
        await conn.sendMessage(from, { react: { text: 'ℹ️', key: mek.key } }).catch(() => {});
        return reply(
            `📦 *NPM Package Lookup*\n\n` +
            `📌 *Usage:* .npm [package_name]\n\n` +
            `📝 *Example:*\n` +
            `.npm express`
        );
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        const { data: pkg } = await axios.get(
            `https://registry.npmjs.org/${encodeURIComponent(pkgName)}`,
            {
                timeout: 15000,
                headers: { 'User-Agent': `${BOT_NAME}-Bot/1.0` },
                validateStatus: s => s === 200 || s === 404
            }
        );

        if (!pkg || !pkg.name) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
            return reply(`❌ *Package not found:* "${pkgName}"\n\nCheck the name and try again.`);
        }

        const latest = pkg['dist-tags']?.latest || 'N/A';
        const info   = pkg.versions?.[latest] || {};

        // ── Author ──────────────────────────
        let author = 'N/A';
        if (pkg.author) {
            author = typeof pkg.author === 'string'
                ? pkg.author
                : (pkg.author.name || 'N/A');
        } else if (info.author) {
            author = typeof info.author === 'string'
                ? info.author
                : (info.author.name || 'N/A');
        }

        // ── Repository ──────────────────────
        let repo = null;
        if (pkg.repository) {
            const raw = typeof pkg.repository === 'string'
                ? pkg.repository
                : (pkg.repository.url || '');
            repo = raw.replace(/^git\+/, '').replace(/\.git$/, '');
        }

        // ── Build message ───────────────────
        const lines = [
            `📦 *NPM PACKAGE INFO*`,
            ``,
            `📌 *Name:* ${pkg.name}`,
            `📌 *Version:* ${latest}`,
            `📌 *Description:* ${pkg.description || 'N/A'}`,
            `👤 *Author:* ${author}`,
            `📜 *License:* ${pkg.license || info.license || 'N/A'}`
        ];

        if (pkg.homepage) lines.push(`🌐 *Homepage:* ${pkg.homepage}`);
        if (repo)         lines.push(`📂 *Repository:* ${repo}`);
        if (pkg.time?.modified) {
            lines.push(`📅 *Last Modified:* ${new Date(pkg.time.modified).toLocaleDateString()}`);
        }
        lines.push(`📊 *NPM Page:* https://www.npmjs.com/package/${pkg.name}`);
        lines.push('');

        const kw = info.keywords || [];
        if (kw.length) {
            lines.push(`🏷️ *Keywords:* ${kw.slice(0, 5).join(', ')}${kw.length > 5 ? '...' : ''}`);
            lines.push('');
        }

        const deps = Object.keys(info.dependencies || {});
        if (deps.length) {
            lines.push(`📦 *Dependencies:* ${deps.slice(0, 5).join(', ')}${deps.length > 5 ? '...' : ''}`);
            lines.push('');
        }

        lines.push(`📥 *Install:*`);
        lines.push(`\`npm install ${pkg.name}\``);
        lines.push('');
        lines.push(`🔧 *Dev Install:*`);
        lines.push(`\`npm install --save-dev ${pkg.name}\``);
        lines.push('');
        lines.push(`⚡ Powered by ${BOT_NAME}`);

        await reply(lines.join('\n'));
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});

    } catch (error) {
        console.error('[npm]', error.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});

        if (error.response?.status === 404) {
            return reply(`❌ *Package not found:* "${pkgName}"`);
        }
        return reply(`❌ *Error fetching package:*\n_${error.message}_`);
    }
});