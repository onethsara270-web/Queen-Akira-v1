// plugins/status.js
const config = require('../config');
const { cmd } = require('../command');

// ── Config ───────────────────────────────
const BOT_NAME = "Queen Zara";
// ─────────────────────────────────────────

// ── Bold text helper ─────────────────────
const BOLD = {
    a:'𝗮',b:'𝗯',c:'𝗰',d:'𝗱',e:'𝗲',f:'𝗳',g:'𝗴',h:'𝗵',i:'𝗶',j:'𝗷',k:'𝗸',l:'𝗹',m:'𝗺',
    n:'𝗻',o:'𝗼',p:'𝗽',q:'𝗾',r:'𝗿',s:'𝘀',t:'𝘁',u:'𝘂',v:'𝘃',w:'𝘄',x:'𝘅',y:'𝘆',z:'𝘇',
    A:'𝗔',B:'𝗕',C:'𝗖',D:'𝗗',E:'𝗘',F:'𝗙',G:'𝗚',H:'𝗛',I:'𝗜',J:'𝗝',K:'𝗞',L:'𝗟',M:'𝗠',
    N:'𝗡',O:'𝗢',P:'𝗣',Q:'𝗤',R:'𝗥',S:'𝗦',T:'𝗧',U:'𝗨',V:'𝗩',W:'𝗪',X:'𝗫',Y:'𝗬',Z:'𝗭',
    '0':'𝟬','1':'𝟭','2':'𝟮','3':'𝟯','4':'𝟰','5':'𝟱','6':'𝟲','7':'𝟳','8':'𝟴','9':'𝟵'
};
const toBold = (t) => String(t).split('').map(c => BOLD[c] || c).join('');

// ── Default settings ─────────────────────
function ensureSettings(botData, userId) {
    if (!botData.statusSettings) botData.statusSettings = {};
    if (!botData.statusSettings[userId]) {
        botData.statusSettings[userId] = {
            autoStatus:   false,
            autoSeen:     false,
            autoLike:     false,
            autoDownload: false,
            system:       1,
            isPublic:     false
        };
    }
    return botData.statusSettings[userId];
}

cmd({
    pattern: "status",
    alias: ["statusconfig", "autostatus"],
    use: '.status <on|off|seen|like|download|system>',
    desc: "Configure auto status features",
    category: "owner",
    react: "📊",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isCreator, isOwner, sender, botData, saveBotData }) => {

    // ── Owner only ──────────────────────────
    if (!isCreator && !isOwner) {
        await conn.sendMessage(from, { react: { text: '⛔', key: mek.key } }).catch(() => {});
        return reply('❌ *Only the bot owner can use this command.*');
    }

    if (!botData) {
        return reply('❌ *botData not available — check the handler params.*');
    }

    const s = ensureSettings(botData, sender);
    const save = () => saveBotData?.();

    // ── Parse ───────────────────────────────
    const args   = (q || '').trim().split(/\s+/).filter(Boolean);
    const action = (args[0] || '').toLowerCase();
    const val    = (args[1] || '').toLowerCase();

    // ── No action → show menu ───────────────
    if (!action) {
        const menu =
            `╭━━━〔 ${toBold('STATUS SETTINGS')} 〕━━━┈⊷\n` +
            `┃ ⋄ ${toBold('Auto Status:')}   ${s.autoStatus   ? '✅' : '❌'}\n` +
            `┃ ⋄ ${toBold('Auto Seen:')}     ${s.autoSeen     ? '✅' : '❌'}\n` +
            `┃ ⋄ ${toBold('Auto Like:')}     ${s.autoLike     ? '✅' : '❌'}\n` +
            `┃ ⋄ ${toBold('Auto Download:')} ${s.autoDownload ? '✅' : '❌'}\n` +
            `┃ ⋄ ${toBold('System:')}        ${s.system || 1}\n` +
            `╰━━━━━━━━━━━━━━━━━━┈⊷\n\n` +
            `*Commands:*\n` +
            `.status on/off\n` +
            `.status seen on/off\n` +
            `.status like on/off\n` +
            `.status download on/off\n` +
            `.status system 1/2/3`;
        return reply(menu);
    }

    // ── ON / OFF (all features) ─────────────
    if (action === 'on' || action === 'off') {
        const state = action === 'on';
        Object.assign(s, {
            autoStatus:   state,
            autoSeen:     state,
            autoLike:     state,
            autoDownload: state
        });
        save();
        await conn.sendMessage(from, { react: { text: state ? '✅' : '❌', key: mek.key } }).catch(() => {});
        return reply(state
            ? '✅ *ALL STATUS FEATURES: ON*'
            : '❌ *ALL STATUS FEATURES: OFF*');
    }

    // ── Feature toggles ─────────────────────
    const features = {
        seen:     'autoSeen',
        like:     'autoLike',
        download: 'autoDownload'
    };

    if (features[action]) {
        if (val !== 'on' && val !== 'off') {
            return reply(`❌ *Usage:* .status ${action} on|off`);
        }
        const state = val === 'on';
        s[features[action]] = state;
        if (state) s.autoStatus = true;   // implied
        save();
        const label = action.charAt(0).toUpperCase() + action.slice(1);
        await conn.sendMessage(from, { react: { text: state ? '✅' : '❌', key: mek.key } }).catch(() => {});
        return reply(`${state ? '✅' : '❌'} *Auto ${label}: ${state ? 'ON' : 'OFF'}*`);
    }

    // ── System ──────────────────────────────
    if (action === 'system') {
        const sys = parseInt(val, 10);
        if (![1, 2, 3].includes(sys)) {
            return reply('❌ *Choose system 1, 2, or 3.*');
        }
        s.system = sys;
        save();
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
        return reply(`✅ *System set to: ${sys}*`);
    }

    // ── Unknown action ──────────────────────
    return reply(`❌ *Unknown action:* ${action}\n\nUse \`.status\` to see the menu.`);
});