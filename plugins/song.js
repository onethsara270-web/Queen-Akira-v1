// plugins/song.js
// 🎵 YouTube Song Downloader — Carousel + Button taps + Multi-API fallback
const yts = require("yt-search");
const axios = require("axios");
const { cmd } = require('../command');

// ============ BAILEYS LOADER ============
const baileys = (() => {
  for (const n of ["fixo-baileys", "baileyz", "@whiskeysockets/baileys", "baileys"]) {
    try { return require(n); } catch (_) {}
  }
  throw new Error("No baileys package found");
})();
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = baileys;

// ============ CONFIG ============
const AI_MARK = true;
const CAROUSEL_AI_MARK = false;
const ELITE_API = "https://eliteprotech-apis.zone.id/download/ytmp3";
const NIMA_API = process.env.NIMA_YT_API_URL || "https://nima-song-api-nocache.up.railway.app";
const MAX_SECONDS = 20 * 60;
const MAX_RESULTS = 8;
const DEFAULT_FOOTER = "© Powered by Zepix-AI";
const BTN_PREFIX = "zytdl";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errText = (e) => String((e && (e.message || e.error)) || e || "unknown error").slice(0, 250);

// ============ AI MARK ============
const AI_BOT_NODE = { tag: "bot", attrs: { biz_bot: "1" } };
const AI_NODES = [{ tag: "biz", attrs: {}, content: [AI_BOT_NODE] }];

const NATIVE_FLOW_NODE = {
  tag: "interactive",
  attrs: { type: "native_flow", v: "1" },
  content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }],
};
const CAROUSEL_NODES_AI = [{ tag: "biz", attrs: {}, content: [NATIVE_FLOW_NODE, AI_BOT_NODE] }];
const CAROUSEL_NODES_PLAIN = [{ tag: "biz", attrs: {}, content: [NATIVE_FLOW_NODE] }];

// ============ SEND HELPERS ============
async function sendText(conn, jid, content, quoted) {
  const base = quoted ? { quoted } : {};
  if (AI_MARK) {
    try {
      return await conn.sendMessage(jid, content, { ...base, additionalNodes: AI_NODES });
    } catch (e) {
      console.log("[song] AI mark send failed, retrying plain:", errText(e));
    }
  }
  return conn.sendMessage(jid, content, base);
}

async function editMsg(conn, jid, key, text) {
  try {
    if (AI_MARK) {
      try {
        return await conn.sendMessage(jid, { text, edit: key }, { additionalNodes: AI_NODES });
      } catch (_) {}
    }
    await conn.sendMessage(jid, { text, edit: key });
  } catch (e) {
    console.log("[song] edit failed:", errText(e));
  }
}

async function react(conn, jid, key, emoji) {
  try { await conn.sendMessage(jid, { react: { text: emoji, key } }); } catch (_) {}
}

// ============ HELPERS ============
function unwrap(message) {
  let m = message || {};
  for (let i = 0; i < 4; i++) {
    const inner =
      m.ephemeralMessage?.message ||
      m.viewOnceMessage?.message ||
      m.viewOnceMessageV2?.message ||
      m.documentWithCaptionMessage?.message ||
      m.editedMessage?.message;
    if (!inner) break;
    m = inner;
  }
  return m;
}

function getText(msg) {
  const m = unwrap(msg.message);
  const nf = m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
  if (nf) {
    try { const id = JSON.parse(nf).id; if (id) return String(id); } catch (_) {}
  }
  return (
    m.buttonsResponseMessage?.selectedButtonId ||
    m.templateButtonReplyMessage?.selectedId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ""
  );
}

function extractId(input) {
  const match = input.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|music\.youtube\.com\/watch\?v=)([\w-]{11})/
  );
  return match ? match[1] : null;
}

function findDownloadUrlInJson(obj, depth = 0) {
  if (!obj || depth > 5) return null;
  if (typeof obj === "string") return /^https?:\/\//i.test(obj) ? obj : null;
  if (typeof obj !== "object") return null;

  const bad = /youtube\.com|youtu\.be|ytimg\.com/i;
  const priority = ["download_url", "downloadUrl", "download", "dl", "dlink", "link", "url", "audio", "mp3", "file"];
  for (const k of priority) {
    if (typeof obj[k] === "string" && /^https?:\/\//i.test(obj[k]) && !bad.test(obj[k])) return obj[k];
  }
  for (const k of Object.keys(obj)) {
    if (/thumb|image|cover|poster|icon/i.test(k)) continue;
    const v = obj[k];
    if (typeof v === "string" && /^https?:\/\//i.test(v) && /download|dl|mp3|audio|link|url|file/i.test(k) && !bad.test(v)) return v;
  }
  for (const k of Object.keys(obj)) {
    if (/thumb|image|cover|poster|icon/i.test(k)) continue;
    if (typeof obj[k] === "object") {
      const f = findDownloadUrlInJson(obj[k], depth + 1);
      if (f) return f;
    }
  }
  return null;
}

// ============ DOWNLOADERS ============
async function fromElite(videoUrl, quality = 128) {
  const res = await axios.get(ELITE_API, {
    params: { url: videoUrl, quality },
    responseType: "arraybuffer",
    timeout: 120000,
    maxContentLength: 200 * 1024 * 1024,
    validateStatus: () => true,
  });
  if (res.status !== 200) throw new Error(`Elite HTTP ${res.status}`);

  const ct = String(res.headers["content-type"] || "").toLowerCase();
  const raw = Buffer.from(res.data);

  if (ct.startsWith("audio/") || ct.includes("octet-stream")) {
    if (raw.length < 10 * 1024) throw new Error("Elite audio too small");
    return raw;
  }

  let json;
  try { json = JSON.parse(raw.toString("utf-8")); }
  catch (_) { throw new Error("Elite invalid response"); }

  if (json && (json.status === false || json.success === false || json.status === "error")) {
    throw new Error("Elite: " + String(json.message || json.error || "API error").slice(0, 100));
  }

  const dlUrl = findDownloadUrlInJson(json.result || json.data || json);
  if (!dlUrl) throw new Error("Elite: no download link");

  const file = await axios.get(dlUrl, {
    responseType: "arraybuffer",
    timeout: 180000,
    maxContentLength: 200 * 1024 * 1024,
    headers: { "User-Agent": "Mozilla/5.0" },
    validateStatus: () => true,
  });
  if (file.status !== 200) throw new Error(`Elite file HTTP ${file.status}`);
  const buf = Buffer.from(file.data);
  if (buf.length < 10 * 1024) throw new Error("Elite file too small");
  return buf;
}

async function fromNima(id, type = "mp3") {
  const endpoint = type === "ogg" ? "audio-ogg" : "audio";
  const res = await axios.get(`${NIMA_API}/${endpoint}?id=${id}`, {
    responseType: "arraybuffer",
    timeout: 180000,
    maxContentLength: 200 * 1024 * 1024,
    validateStatus: () => true,
  });
  if (res.status !== 200) {
    let msg = `HTTP ${res.status}`;
    try { msg = JSON.parse(Buffer.from(res.data).toString("utf-8")).error || msg; } catch (_) {}
    throw new Error("NIMA " + msg);
  }
  const buf = Buffer.from(res.data);
  if (buf.length < 10 * 1024) throw new Error("NIMA audio too small");
  return buf;
}

async function getAudioBuffer(id) {
  const videoUrl = `https://www.youtube.com/watch?v=${id}`;
  const errors = [];

  try {
    const buf = await fromElite(videoUrl, 128);
    console.log(`[song] Elite OK (${(buf.length / 1048576).toFixed(2)} MB)`);
    return buf;
  } catch (e) {
    console.log("[song] Elite failed:", errText(e));
    errors.push(errText(e));
  }

  try {
    const buf = await fromNima(id, "mp3");
    console.log(`[song] NIMA OK (${(buf.length / 1048576).toFixed(2)} MB)`);
    return buf;
  } catch (e) {
    console.log("[song] NIMA failed:", errText(e));
    errors.push(errText(e));
  }

  throw new Error("All methods failed → " + errors.join(" | "));
}

// ============ CAROUSEL ============
async function sendCarousel(conn, jid, mek, query, videos, footer) {
  const cards = await Promise.all(
    videos.map(async (v) => {
      const thumb = v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
      let media = {};
      try {
        media = await prepareWAMessageMedia({ image: { url: thumb } }, { upload: conn.waUploadToServer });
      } catch (e) {
        console.log("[song] thumb upload failed:", errText(e));
      }

      const btn = (label, type) => ({
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: label,
          id: `${BTN_PREFIX}|${type}|${v.videoId}`,
        }),
      });

      return {
        header: { title: "", hasMediaAttachment: !!media.imageMessage, ...media },
        body: {
          text:
            `*${v.title}*\n\n` +
            `⏱️ ${v.timestamp || "N/A"}   👁️ ${(v.views ?? 0).toLocaleString("en-US")}\n` +
            `📺 ${v.author?.name || "Unknown"}\n` +
            `🕒 ${v.ago || "N/A"}`,
        },
        footer: { text: footer },
        nativeFlowMessage: {
          buttons: [btn("🎵 SONG", "audio"), btn("🎤 VOICE", "voice")],
          messageParamsJson: "",
        },
      };
    })
  );

  const content = {
    viewOnceMessage: {
      message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage: proto.Message.InteractiveMessage.create({
          body: { text: `🔍 *${query}*\n\n_SWIPE ➡️ AND TAP A BUTTON_` },
          footer: { text: footer },
          header: { title: "", hasMediaAttachment: false },
          carouselMessage: { cards, messageVersion: 1 },
        }),
      },
    },
  };

  const nodes = AI_MARK && CAROUSEL_AI_MARK ? CAROUSEL_NODES_AI : CAROUSEL_NODES_PLAIN;
  const m = generateWAMessageFromContent(jid, content, { quoted: mek, userJid: conn.user?.id });
  await conn.relayMessage(jid, m.message, { messageId: m.key.id, additionalNodes: nodes });
}

async function sendCardList(conn, jid, mek, query, videos, footer) {
  await sendText(conn, jid, { text: `🔍 *${query}*\n\n👇 Tap a button below (${videos.length})` }, mek);

  for (const v of videos) {
    const thumb = v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
    const caption =
      `*${v.title}*\n\n` +
      `⏱️ ${v.timestamp || "N/A"}   👁️ ${(v.views ?? 0).toLocaleString("en-US")}\n` +
      `📺 ${v.author?.name || "Unknown"}\n` +
      `🕒 ${v.ago || "N/A"}`;
    const buttons = [
      { buttonId: `${BTN_PREFIX}|audio|${v.videoId}`, buttonText: { displayText: "🎵 SONG" }, type: 1 },
      { buttonId: `${BTN_PREFIX}|voice|${v.videoId}`, buttonText: { displayText: "🎤 VOICE" }, type: 1 },
    ];
    try {
      await conn.sendMessage(jid, { image: { url: thumb }, caption, footer, buttons, headerType: 4 }, { quoted: mek });
    } catch (e) {
      console.log("[song] card send failed:", errText(e));
    }
    await sleep(500);
  }
}

// ============ DOWNLOAD HANDLER ============
async function handleDownload({ conn, mek, sender, type, id }) {
  let status = null;
  let step = "start";
  try {
    await react(conn, sender, mek.key, "📥");

    step = "status";
    status = await sendText(conn, sender, { text: `🤖 *ZYRA AI Agent*\n\n🔎 Getting info...\n▰▱▱▱▱` });
    const key = status.key;
    console.log(`[song] step=${step} OK`);

    step = "yts";
    let title = "song";
    try {
      const video = await yts({ videoId: id });
      if (video) {
        title = video.title || title;
        const seconds = video.seconds ?? 0;
        if (seconds > MAX_SECONDS) {
          return await editMsg(conn, sender, key,
            `🤖 *ZYRA AI Agent*\n\n⚠️ Too long (${Math.floor(seconds / 60)} min). Pick one under 20 minutes.`);
        }
      }
    } catch (e) {
      console.log("[song] yts failed (continuing):", errText(e));
    }
    console.log(`[song] step=${step} OK title=${title}`);

    const safeTitle = title.replace(/[^\w\s\u0D80-\u0DFF-]/g, "").slice(0, 60).trim() || "song";

    step = "edit";
    await editMsg(conn, sender, key,
      `🤖 *ZYRA AI Agent*\n\n✅ *Found!*\n🎶 ${title}\n\n⬇️ Downloading ${type === "voice" ? "Voice" : "Audio"}...\n▰▰▰▱▱`);

    step = "download";
    let buf, mime;
    if (type === "voice") {
      try {
        buf = await fromNima(id, "ogg");
        mime = "audio/ogg; codecs=opus";
      } catch (e) {
        console.log("[song] ogg failed, using mp3:", errText(e));
      }
    }
    if (!buf) {
      buf = await getAudioBuffer(id);
      mime = "audio/mpeg";
    }
    console.log(`[song] step=${step} OK size=${buf.length}`);

    step = "send";
    if (type === "voice") {
      await conn.sendMessage(sender, { audio: buf, mimetype: mime, ptt: true });
    } else {
      try {
        await conn.sendMessage(sender, {
          audio: buf,
          mimetype: "audio/mpeg",
          fileName: `${safeTitle}.mp3`,
          ptt: false,
        });
      } catch (e) {
        console.log("[song] audio send failed, sending as document:", errText(e));
        await conn.sendMessage(sender, {
          document: buf,
          mimetype: "audio/mpeg",
          fileName: `${safeTitle}.mp3`,
        });
      }
    }
    console.log(`[song] step=${step} OK`);

    step = "final";
    await editMsg(conn, sender, key,
      `🤖 *ZYRA AI Agent*\n\n✅ *Done!*\n🎶 ${title}\n▰▰▰▰▰\n\n_Thanks for using Zepix-AI_ 💚`);
    await react(conn, sender, mek.key, "✅");
  } catch (e) {
    console.error(`[song] Download error at step "${step}":`, e);
    await react(conn, sender, mek.key, "❌");
    const text = `🤖 *ZYRA AI Agent*\n\n❌ Download failed.\n_[${step}] ${errText(e)}_`;
    if (status?.key) {
      await editMsg(conn, sender, status.key, text);
    } else {
      await sendText(conn, sender, { text });
    }
  }
}

// ============ SEARCH HANDLER ============
async function handleSearch({ conn, mek, sender, footer, query }) {
  let status = null;
  try {
    await react(conn, sender, mek.key, "🔎");

    status = await sendText(conn, sender, { text: `🤖 *ZYRA AI Agent*\n\n🔎 Searching _"${query}"_...\n▱▱▱▱▱` }, mek);
    const key = status.key;

    await sleep(600);
    await editMsg(conn, sender, key, `🤖 *ZYRA AI Agent*\n\n🧠 Scanning YouTube...\n▰▰▱▱▱`);

    let videos = [];
    const urlId = extractId(query);
    if (urlId) {
      const v = await yts({ videoId: urlId });
      if (v) videos = [v];
    } else {
      const res = await yts(query);
      videos = (res.videos || []).filter((v) => (v.seconds ?? 0) <= MAX_SECONDS).slice(0, MAX_RESULTS);
    }

    if (!videos.length) {
      await react(conn, sender, mek.key, "❌");
      return await editMsg(conn, sender, key,
        `🤖 *ZYRA AI Agent*\n\n❌ No results for "${query}".`);
    }

    await editMsg(conn, sender, key,
      `🤖 *ZYRA AI Agent*\n\n✅ *${videos.length} results found!*\n\n🖼️ Building cards...\n▰▰▰▰▱`);

    try {
      await sendCarousel(conn, sender, mek, query, videos, footer);
    } catch (e) {
      console.log("[song] Carousel failed, using fallback:", errText(e));
      await sendCardList(conn, sender, mek, query, videos, footer);
    }

    await editMsg(conn, sender, key,
      `🤖 *ZYRA AI Agent*\n\n✅ *${videos.length} results found!*\n👉 Swipe and tap a button.\n▰▰▰▰▰`);
    await react(conn, sender, mek.key, "✅");
  } catch (e) {
    console.error("[song] Search error:", e);
    await react(conn, sender, mek.key, "❌");
    if (status?.key) {
      await editMsg(conn, sender, status.key,
        `🤖 *ZYRA AI Agent*\n\n❌ Search error.\n_${errText(e)}_`);
    } else {
      await sendText(conn, sender, { text: "❌ Search error." }, mek);
    }
  }
}

// ============ DEDUPE ============
const seen = new Set();

// ============ MAIN COMMAND ============
cmd({
  pattern: "song",
  alias: ["play", "audio", "ytmp3"],
  use: ".song <query or YouTube URL>",
  desc: "Search & download audio from YouTube",
  category: "download",
  react: "🎵",
  filename: __filename
}, async (conn, mek, m, { from, q, reply, botConfig }) => {
  if (!q) {
    return reply(`🎵 *Song name or YouTube link:*\n\nExample: .song Sanda Eliye`);
  }
  const footer = botConfig?.BOT_FOOTER || DEFAULT_FOOTER;
  return await handleSearch({ conn, mek, sender: from, footer, query: q });
});

// ============ BUTTON TAP HANDLER (via on:'body') ============
cmd({
  on: "body",
  dontAddCommandList: true,
  filename: __filename
}, async (conn, mek, m, { from, body }) => {
  if (!body || !body.startsWith(BTN_PREFIX + "|")) return;

  if (seen.has(mek.key.id)) return;
  seen.add(mek.key.id);
  if (seen.size > 500) seen.delete(seen.values().next().value);

  const [, type, id] = body.split("|");
  if (!["audio", "voice"].includes(type) || !/^[\w-]{11}$/.test(id || "")) return;

  await handleDownload({ conn, mek, sender: from, type, id });
});
