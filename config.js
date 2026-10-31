// config.js — Per-bot aware (AsyncLocalStorage Proxy)
const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

// config.env එකේ තියෙන දේවල් load කරගන්නවා
if (fs.existsSync('config.env')) require('dotenv').config({ path: './config.env' });

const DATA_DIR = process.env.DATA_DIR || __dirname;
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const DEFAULT_PATH = path.join(__dirname, 'config.default.json');

console.log(`📂 [config.js] Reading from: ${CONFIG_PATH}`);

function convertToBool(text, fault = 'true') {
    return text === fault ? true : false;
}

function loadJsonConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
            console.log('✅ config.json loaded from:', CONFIG_PATH);
            return cfg;
        } else if (fs.existsSync(DEFAULT_PATH)) {
            const def = JSON.parse(fs.readFileSync(DEFAULT_PATH, 'utf8'));
            const dir = path.dirname(CONFIG_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(def, null, 2), 'utf8');
            console.log('✅ config.json created from defaults at:', CONFIG_PATH);
            return def;
        }
    } catch (e) {
        console.error('❌ config.json parse error:', e.message);
    }
    return {};
}

let jsonConfig = loadJsonConfig();

function get(key, defaultValue) {
    if (jsonConfig[key] !== undefined && jsonConfig[key] !== '') return jsonConfig[key];
    if (process.env[key] !== undefined && process.env[key] !== '') return process.env[key];
    return defaultValue;
}

// ══════════════════════════════════════════════════════════════
// 🏗️ BASE CONFIG — හැම සෙටින්ග් එකක්ම මෙතන
// ══════════════════════════════════════════════════════════════
const baseConfig = {
    // ─── BOT CORE ───
    // Optional: base64 of creds.json. Leave empty to link via the pairing code (printed in console + shown on dashboard)
    SESSION_ID: process.env.SESSION_ID || get('SESSION_ID', ""),
    PREFIX: get('PREFIX', "."),
    BOT_NAME: get('BOT_NAME', "𝑸𝒖𝒆𝒆𝒏 𝑨𝒌𝒊𝒓𝒂 𝑴𝒊𝒏𝒊"),
    STICKER_NAME: get('STICKER_NAME', "𝑸𝒖𝒆𝒆𝒏 𝑨𝒌𝒊𝒓𝒂 𝑴𝒊𝒏𝒊"),
    MODE: get('MODE', "public"),
    ALWAYS_ONLINE: get('ALWAYS_ONLINE', "false"),
    READ_MESSAGE: get('READ_MESSAGE', "false"),
    AUTO_REACT: get('AUTO_REACT', "false"),
    READ_CMD: get('READ_CMD', "false"),
    AUTO_TYPING: get('AUTO_TYPING', "false"),
    AUTO_RECORDING: get('AUTO_RECORDING', "false"),

    // ─── OWNER INFO ───
    OWNER_NUMBER: get('OWNER_NUMBER', "94703945265"),
    OWNER_NAME: get('OWNER_NAME', "FIXO DEV"),
    DESCRIPTION: get('DESCRIPTION', "*© ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝑸𝒖𝒆𝒆𝒏 𝑨𝒌𝒊𝒓𝒂 𝑴𝒊𝒏𝒊*"),
    DEV: process.env.DEV || "94703945265",
    
   
    // ─── CHANNELS (newsletter) ───
    // NEWSLETTER_JID  : used for the "forwarded from channel" badge on bot messages
    // CHANNEL_LINK    : main channel link (auto-followed on connect)
    // CHANNEL_LINKS   : extra channel links, comma separated (all auto-followed)
    //                   -> or use the owner commands: .addchannel <link> / .delchannel <n> / .channels
    NEWSLETTER_JID: get('NEWSLETTER_JID', "120363409660898486@newsletter"),
    NEWSLETTER_NAME: get('NEWSLETTER_NAME', "𝑸𝒖𝒆𝒆𝒏 𝑨𝒌𝒊𝒓𝒂 𝑴𝒊𝒏𝒊"),
    CHANNEL_LINK: get('CHANNEL_LINK', "https://whatsapp.com/channel/0029Vb8c75l1SWstC9vY7c37"),
    CHANNEL_LINKS: get('CHANNEL_LINKS', ""),
    GROUP_LINK: get('GROUP_LINK', ""),

    // ─── STATUS SETTINGS ───
    AUTO_STATUS_SEEN: get('AUTO_STATUS_SEEN', "true"),
    AUTO_STATUS_REPLY: get('AUTO_STATUS_REPLY', "false"),
    AUTO_STATUS_REACT: get('AUTO_STATUS_REACT', "true"),
    AUTO_STATUS_MSG: get('AUTO_STATUS_MSG', "*SEEN YOUR STATUS 🤍*"),
    STATUS_REACT_MODE: get('STATUS_REACT_MODE', "default"),
    CUSTOM_STATUS_EMOJI: get('CUSTOM_STATUS_EMOJI', "❤️"),
    CUSTOM_STATUS_EMOJIS: get('CUSTOM_STATUS_EMOJIS', "❤️,🔥,💯,😍,🥰,👏,🎉,✨,💫,🌟"),

    // ─── AUTO REPLY / AI ───
    AUTO_REPLY: get('AUTO_REPLY', "false"),
    AUTO_AI: get('AUTO_AI', "false"),
    AUTO_AI_COOLDOWN: get('AUTO_AI_COOLDOWN', "3"),
    AUTO_AI_GROUPS: get('AUTO_AI_GROUPS', "false"),
    AUTO_AI_DMS: get('AUTO_AI_DMS', "true"),

    // ─── MEDIA SETTINGS ───
    AUTO_VOICE: get('AUTO_VOICE', "false"),
    AUTO_STICKER: get('AUTO_STICKER', "false"),
    ALIVE_IMG: get('ALIVE_IMG', "https://files.catbox.moe/vhs0nb.png"),
    LIVE_MSG: get('LIVE_MSG', "> HELLO I'AM *𝑸𝒖𝒆𝒆𝒏 𝑨𝒌𝒊𝒓𝒂 𝑴𝒊𝒏𝒊*⚡"),
    BUTTON: get('BUTTON', "true"),

    // ─── SECURITY / ANTILINK ───
    ANTI_BAD: get('ANTI_BAD', "true"),
    ANTI_VV: get('ANTI_VV', "true"),
    DELETE_LINKS: get('DELETE_LINKS', "false"),
    ANTI_LINK: get('ANTI_LINK', "false"),
    ANTI_LINK_ENABLED: get('ANTI_LINK_ENABLED', get('ANTI_LINK', "false")),
    ANTI_LINK_ACTION: get('ANTI_LINK_ACTION', "delete"),
    ANTI_LINK_WARN_LIMIT: get('ANTI_LINK_WARN_LIMIT', "3"),
    ANTI_LINK_WHITELIST: get('ANTI_LINK_WHITELIST', "whatsapp.com,youtube.com,github.com"),
    ANTI_LINK_WHITELIST_ENABLED: get('ANTI_LINK_WHITELIST_ENABLED', "true"),
    ANTI_LINK_NOTIFY: get('ANTI_LINK_NOTIFY', "true"),
    ANTI_LINK_SKIP_ADMINS: get('ANTI_LINK_SKIP_ADMINS', "true"),
    ANTI_LINK_SKIP_BOT: get('ANTI_LINK_SKIP_BOT', "true"),

    // ─── DATABASE & API ───
    // Dashboard login password (change it! or set DASHBOARD_PASSWORD env)
    DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD || get('DASHBOARD_PASSWORD', 'fixo123'),
    // MongoDB (env MONGODB_URI overrides). Stores config, users and the owner session.
    MONGODB_URI: process.env.MONGODB_URI || get('MONGODB_URI', 'mongodb+srv://fixodev1_db_user:tYaX69ozKljm0Eha@cluster0.t8xf96n.mongodb.net/adcash_lk?appName=Cluster0'),
    MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || get('MONGODB_DB_NAME', 'adcash_lk')
};

console.log('🔑 SESSION_ID:', baseConfig.SESSION_ID ? 'loaded' : 'not set (pairing code will be used)');
console.log('⚙️ PREFIX:', baseConfig.PREFIX);
console.log('🛡️ ANTI_LINK:', baseConfig.ANTI_LINK_ENABLED, '| action:', baseConfig.ANTI_LINK_ACTION);
if(baseConfig.CHANNEL_LINK) console.log('📢 Channel Link Loaded:', baseConfig.CHANNEL_LINK);
if(baseConfig.CHANNEL_LINKS) console.log('📢 Extra Channel Links Loaded:', baseConfig.CHANNEL_LINKS);
if(baseConfig.GROUP_LINK) console.log('👥 Group Link Loaded:', baseConfig.GROUP_LINK);

// ══════════════════════════════════════════════════════════════
// 🎯 PER-BOT CONTEXT (AsyncLocalStorage)
// ══════════════════════════════════════════════════════════════
const botStore = new AsyncLocalStorage();

// ══════════════════════════════════════════════════════════════
// 🔮 PROXY
// ══════════════════════════════════════════════════════════════
const configProxy = new Proxy(baseConfig, {
    get(target, prop) {
        if (prop === '_base') return baseConfig;
        if (prop === '_reload') return reloadConfig;
        if (prop === '_withBot') return withBotConfig;
        if (prop === '_getStore') return () => botStore.getStore();
        if (prop === '_setBotConfig') return setBotConfig;
        if (prop === '_getBotConfig') return getBotConfig;
        if (prop === '_allKeys') return allKeys;
        if (prop === '_getRaw') return () => jsonConfig;
        if (prop === '_save') return saveJsonConfig;
        if (prop === '_path') return CONFIG_PATH;

        const store = botStore.getStore();
        if (store && store.botConfig && store.botConfig[prop] !== undefined) {
            return store.botConfig[prop];
        }
        return target[prop];
    },
    set(target, prop, value) {
        const store = botStore.getStore();
        if (store && store.botConfig) {
            store.botConfig[prop] = value;
        }
        target[prop] = value;
        return true;
    },
    has(target, prop) {
        if (prop in target) return true;
        const store = botStore.getStore();
        if (store && store.botConfig && prop in store.botConfig) return true;
        return false;
    }
});

// ══════════════════════════════════════════════════════════════
// 🔧 HELPERS
// ══════════════════════════════════════════════════════════════
function reloadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return false;
        const fresh = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        for (const key in fresh) {
            if (fresh[key] !== undefined) {
                baseConfig[key] = fresh[key];
                jsonConfig[key] = fresh[key];
            }
        }
        console.log('🔄 Config reloaded from:', CONFIG_PATH);
        return true;
    } catch (e) {
        console.error('❌ Reload failed:', e.message);
        return false;
    }
}

function saveJsonConfig(keyOrObj, value) {
    try {
        const patch = typeof keyOrObj === 'object' ? keyOrObj : { [keyOrObj]: value };
        jsonConfig = { ...jsonConfig, ...patch };
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(jsonConfig, null, 2), 'utf8');
        for (const k in patch) baseConfig[k] = patch[k];
        console.log('💾 Config saved to:', CONFIG_PATH, '| keys:', Object.keys(patch).join(', '));
        return true;
    } catch (e) {
        console.error('❌ Save failed:', e.message);
        return false;
    }
}

function withBotConfig(botConfig, fn) {
    return botStore.run({ botConfig: botConfig || {} }, fn);
}

function setBotConfig(conn, cfg) {
    if (conn) conn._userConfig = cfg;
}

function getBotConfig(conn) {
    const store = botStore.getStore();
    if (store && store.botConfig) return store.botConfig;
    if (conn && conn._userConfig) return conn._userConfig;
    return baseConfig;
}

function allKeys(conn) {
    const keys = new Set(Object.keys(baseConfig));
    if (conn && conn._userConfig) Object.keys(conn._userConfig).forEach(k => keys.add(k));
    const store = botStore.getStore();
    if (store && store.botConfig) Object.keys(store.botConfig).forEach(k => keys.add(k));
    return Array.from(keys);
}

module.exports = configProxy;
