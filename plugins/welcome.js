const { cmd } = require('../command');

cmd({
    pattern: "welcome",
    alias: ["setwelcome"],
    use: '.welcome <on|off>',
    desc: "Enable/Disable welcome messages",
    category: "admin",
    react: "👋",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isGroup, isAdmins }) => {
    if (!isGroup) return reply('❌ Group only command.');
    if (!isAdmins) return reply('❌ Only admins can use this.');

    const action = q ? q.toLowerCase().trim() : '';
    global.welcomeGroups = global.welcomeGroups || new Set();

    if (action === 'on') {
        global.welcomeGroups.add(from);
        reply('✅ *Welcome messages enabled for this group!*');
    } else if (action === 'off') {
        global.welcomeGroups.delete(from);
        reply('❌ *Welcome messages disabled.*');
    } else {
        reply('Usage: .welcome on/off');
    }
},

// Group එකට මෙම්බර්ස් එකතු වෙනවා හඳුනාගන්න Event එක
{
    on: 'group-participants.update',
    async event(conn, update) {
        const { id, participants, action } = update;
        if (action !== 'add') return;
        
        global.welcomeGroups = global.welcomeGroups || new Set();
        if (!global.welcomeGroups.has(id)) return;

        try {
            const groupMetadata = await conn.groupMetadata(id);
            const groupName = groupMetadata.subject;

            for (const participant of participants) {
                const user = participant.split('@')[0];
                const text = `👋 *WELCOME* @${user}!\n\nYou are welcome to *${groupName}*. 🎉\n\n> _Powered by Queen Zara Mini_`;
                await conn.sendMessage(id, { text, mentions: [participant] });
            }
        } catch (e) { console.log('Welcome error:', e.message); }
    }
});
