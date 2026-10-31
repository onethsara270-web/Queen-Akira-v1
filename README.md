# 𝑸𝒖𝒆𝒆𝒏 𝑨𝒌𝒊𝒓𝒂 𝑴𝒊𝒏𝒊

WhatsApp multi-device bot by **FIXO DEV** (94703945265) — built on `fixo-baileys`.
Self-contained: no external license server, no external session site.

## Run
Requires **Node.js 22.12+** (`fixo-baileys` is an ES-module package; older Node cannot `require()` it).
```bash
npm install
npm start
```
First start (no session yet): the bot does **not** connect or send anything to your phone.
Open `https://<your-app>/login` → owner password → Dashboard → **Link the owner WhatsApp** →
enter the number → **Generate pairing code**. On that phone: WhatsApp → Linked devices →
*Link with phone number* → type the code.

- The code is only generated when you press the button (never automatically on restart).
- If it is not linked within `PAIR_TIMEOUT_MIN` minutes (default 10) the unfinished session is deleted automatically.
  The same rule deletes user-bot (freebot) numbers that asked for a code but never linked.
- The whole session folder (creds + keys) is saved to MongoDB, so restarts / redeploys on Render etc. reconnect without pairing again.
- If WhatsApp logs the bot out (device removed) the session is deleted and nothing is sent until you link again from the dashboard.

## Config (`config.js` / `config.json` / env)
| Key | Default |
|---|---|
| BOT_NAME | 𝑸𝒖𝒆𝒆𝒏 𝑨𝒌𝒊𝒓𝒂 𝑴𝒊𝒏𝒊 |
| OWNER_NAME / OWNER_NUMBER | FIXO DEV / 94703945265 |
| NEWSLETTER_JID | 120363409660898486@newsletter |
| CHANNEL_LINK | https://whatsapp.com/channel/0029Vb8c75l1SWstC9vY7c37 |
| CHANNEL_LINKS | extra channel links, comma separated |
| MONGODB_URI | set in `config.js` (env `MONGODB_URI` overrides) |
| DASHBOARD_PASSWORD | `fixo123` — **change it** |
| PAIRING_CODE | optional custom 8-char code (1-9, A-Z without I L O U). Empty = library default `FIXOMODZ` |
| PAIR_TIMEOUT_MIN | minutes before an unlinked session is auto-deleted (default 10) |
| SESSION_ID | optional: base64 of `creds.json` (leave empty to use pairing) |

## Multiple channels
All channels (main + extras) are auto-followed on every start.
Owner commands: `.addchannel <link>` · `.delchannel <number|link>` · `.channels`
(or edit `CHANNEL_LINKS` in the dashboard → Settings → 📢 Channels).

## Commands
`.alive` (buttons: Ping / Owner / Menu) · `.ping` · `.menu` (swipeable category cards, OPEN button → `.menu <category>`) · `.owner` · `.channels` · `.password` · `.gstatus` · `.chstatus` · antilink · anti-delete · status seen/react · per-user bots via `/freebot`

## Status plugins
**Group status** — `.gstatus <text>` in a group (admins / owner). Reply to an image / video / audio to post it with an optional caption.
`.gstatus <group link or jid> <text>` posts to another group (owner).

**Channel status** — owner only, the bot account must be admin/owner of the channel.
`.chstatus <text>` → main channel · `.chstatus 2 <text>` → channel #2 · `.chstatus all <text>` → every channel · `.chstatus <channel link> <text>`.
Reply to image / video / audio for media updates.

## Adding a plugin
1. Create a file in `plugins/`, e.g. `plugins/hello.js`. Every `.js` file in that folder is loaded automatically on start.
2. Register a command with `cmd({...}, handler)`:

```js
const { cmd } = require('../command');
const config = require('../config');

cmd({
    pattern: 'hello',          // .hello
    alias: ['hi'],             // .hi also works
    desc: 'Say hello',
    category: 'main',          // groups the command in .menu
    react: '👋',               // reaction sent when the command runs
    filename: __filename
},
async (conn, mek, m, { from, sender, pushname, q, args, isGroup, isOwner, isAdmins, isBotAdmins, reply }) => {
    reply(`Hello ${pushname}! I am ${config.BOT_NAME}`);
});
```
Handler extras: `from, sender, senderNumber, pushname, q (text after command), args, isGroup, isOwner, isAdmins, isBotAdmins, groupMetadata, participants, quoted, reply`.
Use `config.X` for settings (BOT_NAME, OWNER_NAME, ALIVE_IMG, DESCRIPTION, NEWSLETTER_JID …) — they are per-bot aware.
Restart the bot — the new command shows up in `.menu` automatically.

## Adding buttons to a plugin
Buttons are quick-reply buttons. The `buttonId` is just a command: when the user taps it, the bot runs it as if it was typed.

```js
const prefix = config.PREFIX || '.';
await conn.sendMessage(from, {
    image: { url: config.ALIVE_IMG },            // https://files.catbox.moe/vhs0nb.png
    caption: 'Pick one 👇',
    footer: '🔘 Select an option below',
    headerType: 1,
    ai: !isGroup,                                // AI badge in DMs (same as .alive)
    buttons: [
        { buttonId: `${prefix}ping`,  buttonText: { displayText: '🏓 Ping'  }, type: 1 },
        { buttonId: `${prefix}owner`, buttonText: { displayText: '👤 Owner' }, type: 1 },
        { buttonId: `${prefix}menu`,  buttonText: { displayText: '📋 Menu'  }, type: 1 }
    ]
}, { quoted: mek });
```
- `buttonId` must be an existing command (`.ping`, `.menu` or your own `.hello`).
- Use at most 3 buttons in groups. Respect the `BUTTON` setting: `if (String(config.BUTTON) === 'true') { add footer/buttons }`, otherwise send the plain message (see `plugins/alive.js` and `plugins/menu.js`).
- All bot images use `config.ALIVE_IMG` (default `https://files.catbox.moe/vhs0nb.png`, change it in the dashboard).
