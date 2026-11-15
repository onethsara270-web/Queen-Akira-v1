const fs = require('fs');
const path = require('path');
const { cmd } = require('../command');

const CONFIG_PATH = path.join(__dirname, '../data/antispam.json');
if (!fs.existsSync(CONFIG_PATH)) {
    if (!fs.existsSync(path.dirname(CONFIG_PATH))) fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({}), 'utf8');
}

const spamTracker = new Map();

cmd({
    pattern: "antispam",
    alias: ["flood", "antiflood"],
    use: '.antispam <on|off>',
    desc: "Enable/Disable group flood protection",
    category: "admin",
    react: "🛡️",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isGroup, isAdmins, isBotAdmins }) => {
    if (!isGroup) return reply('❌ This command only works in groups.');
    if (!isAdmins) return reply('❌ Only group admins can use this.');

    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const action = q ? q.toLowerCase().trim() : '';

    if (!action || !['on', 'off'].includes(action)) {
        const status = config[from]?.enabled ? '✅ ON' : '❌ OFF';
        return reply(`🛡️ *ANTI-SPAM*\n\nStatus: ${status}\n\nUsage:\n.antispam on\n.antispam off`);
    }

    config[from] = { enabled: action === 'on' };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    reply(`✅ *Anti-spam turned ${action.toUpperCase()}*`);
}, 

// මේක තමයි ඕනම මැසේජ් එකක් ආවම චෙක් කරන කොටස (on: 'body')
{
    on: 'body',
    async body(conn, mek, m, { from, sender, isGroup, isAdmins, isBotAdmins }) {
        if (!isGroup || isAdmins || mek.key.fromMe) return; // Admins ලාට ස්පෑම් කරන්න පුළුවන්
        
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        if (!config[from] || !config[from].enabled) return;

        const now = Date.now();
        const windowMs = 5000; // තත්පර 5
        const maxMsgs = 5;     // උපරිම මැසේජ් 5

        if (!spamTracker.has(from)) spamTracker.set(from, new Map());
        const groupTracker = spamTracker.get(from);

        if (!groupTracker.has(sender)) {
            groupTracker.set(sender, { count: 1, firstMsg: now });
            return;
        }

        const userData = groupTracker.get(sender);
        if (now - userData.firstMsg > windowMs) {
            userData.count = 1;
            userData.firstMsg = now;
            return;
        }

        userData.count++;
        if (userData.count > maxMsgs) {
            userData.count = 0; // Reset
            
            if (!isBotAdmins) return; // Kick කරන්න බොට් ඇඩ්මින් වෙන්න ඕන
            
            try {
                await conn.sendMessage(from, { text: `🚫 @${sender.split('@')[0]} removed for spamming.`, mentions: [sender] });
                await conn.groupParticipantsUpdate(from, [sender], 'remove');
            } catch (e) { console.log('Spam kick error:', e.message); }
        }
    }
});
