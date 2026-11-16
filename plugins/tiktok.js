// plugins/tiktok.js
// 📱 TikTok Video/Audio Downloader — Supun API
const axios = require("axios");
const { cmd } = require('../command');

// ============ CONFIG ============
const BOT_NAME = "𝑸𝒖𝒆𝒆𝒏 𝒁𝒂𝒓𝒂 𝑴𝒊𝒏𝒊";
const DEFAULT_FOOTER = `© ${BOT_NAME}`;
const API_URL = "https://supunofc.site/api/download/tiktok-dl";
const API_KEY = "supun_cd2e010dde9d57802e20651d5a34d0ed";
const MAX_BYTES = 90 * 1024 * 1024;

const errText = (e) => String((e && (e.message || e.error)) || e || "unknown error").slice(0, 250);

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
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ""
  );
}

async function editMsg(conn, jid, key, text) {
  try { await conn.sendMessage(jid, { text, edit: key }); }
  catch (e) { console.log("[ttdl] edit failed:", errText(e)); }
}

async function react(conn, jid, key, emoji) {
  try { await conn.sendMessage(jid, { react: { text: emoji, key } }); } catch (_) {}
}

async function getBuffer(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 180000,
    maxContentLength: MAX_BYTES,
    headers: { "User-Agent": "Mozilla/5.0" },
    validateStatus: () => true,
  });
  if (res.status !== 200) throw new Error(`File HTTP ${res.status}`);
  const buf = Buffer.from(res.data);
  if (buf.length < 10 * 1024) throw new Error("File too small or invalid");
  return buf;
}

// ============ TIKTOK DOWNLOADER (SUPUN API) ============
async function fetchTikTokData(tiktokUrl) {
  const res = await axios.get(API_URL, {
    params: { url: tiktokUrl, apikey: API_KEY },
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0" },
    validateStatus: () => true,
  });

  const j = res.data;
  const d = j?.result?.data;
  if (res.status !== 200 || !j || !j.success || !d) {
    throw new Error("API: " + String(j?.message || j?.error || `HTTP ${res.status}`).slice(0, 100));
  }

  return {
    username: d.author?.uniqueId || d.author?.nickname || "TikTok User",
    title: d.title || "TikTok Video",
    thumbnail: d.thumbnail,
    videoUrl: d.video?.noWatermark || d.video?.watermark,
    audioUrl: d.music?.url,
  };
}

// ============ DOWNLOAD HANDLER ============
async function handleDownload({ conn, mek, sender, url, isAudio, footer }) {
  let status = null;
  let step = "start";
  try {
    await react(conn, sender, mek.key, "📥");

    step = "status";
    status = await conn.sendMessage(sender, {
      text: `🤖 *${BOT_NAME}*\n\n🔎 Fetching TikTok info...\n▰▱▱▱▱`,
    }, { quoted: mek });

    step = "info";
    const data = await fetchTikTokData(url);
    const title = data.title.slice(0, 100);
    const safeName = title.replace(/[^\w\s\u0D80-\u0DFF-]/g, "").trim().slice(0, 50) || "tiktok";

    await editMsg(conn, sender, status.key,
      `🤖 *${BOT_NAME}*\n\n✅ *Info found!*\n👤 *User:* ${data.username}\n🎬 *Caption:* ${title}\n\n⬇️ Downloading ${isAudio ? "Audio" : "Video"}...\n▰▰▰▱▱`);

    step = "download";
    const downloadLink = isAudio ? data.audioUrl : data.videoUrl;
    if (!downloadLink) throw new Error(`${isAudio ? "Audio" : "Video"} URL not found`);

    const buf = await getBuffer(downloadLink);

    step = "send";
    if (isAudio) {
      try {
        await conn.sendMessage(sender, {
          audio: buf,
          mimetype: "audio/mpeg",
          fileName: `${safeName}.mp3`,
          ptt: false,
        }, { quoted: mek });
      } catch (e) {
        console.log("[ttdl] audio send failed, sending as document:", errText(e));
        await conn.sendMessage(sender, {
          document: buf,
          mimetype: "audio/mpeg",
          fileName: `${safeName}.mp3`,
        }, { quoted: mek });
      }
    } else {
      await conn.sendMessage(sender, {
        video: buf,
        mimetype: "video/mp4",
        fileName: `${safeName}.mp4`,
        caption: `👤 *User:* ${data.username}\n🎬 *Caption:* ${title}\n\n${footer}`,
      }, { quoted: mek });
    }

    step = "final";
    await editMsg(conn, sender, status.key,
      `🤖 *${BOT_NAME}*\n\n✅ *Done!*\n🎬 ${title}\n▰▰▰▰▰\n\n_Thanks for using ${BOT_NAME}_ 💚`);
    await react(conn, sender, mek.key, "✅");
  } catch (e) {
    console.error(`[ttdl] Download error at step "${step}":`, e);
    await react(conn, sender, mek.key, "❌");
    const text = `🤖 *${BOT_NAME}*\n\n❌ Download failed.\n_[${step}] ${errText(e)}_`;
    if (status?.key) await editMsg(conn, sender, status.key, text);
    else await conn.sendMessage(sender, { text }, { quoted: mek });
  }
}

// ============ COMMAND ============
cmd({
  pattern: "tiktok",
  alias: ["tt", "ttdl", "tomp3", "ttaudio", "ttaudo"],
  use: ".tiktok <TikTok URL>",
  desc: "Download TikTok video or audio",
  category: "download",
  react: "📱",
  filename: __filename
}, async (conn, mek, m, { from, q, reply, command, botConfig }) => {
  const footer = botConfig?.BOT_FOOTER || DEFAULT_FOOTER;

  if (!q || !/https?:\/\/(www\.|v[tm]\.|tiktok\.com)/i.test(q)) {
    return reply(
      `⚠️ *Please provide a valid TikTok link.*\n\n` +
      `*Examples:*\n` +
      `• *Video:* .tiktok https://vm.tiktok.com/ZSgPfKgJQ/\n` +
      `• *Audio:* .ttaudio https://vm.tiktok.com/ZSgPfKgJQ/`
    );
  }

  const cmdLower = String(command || "").toLowerCase().replace(/^[^a-z]+/, "");
  const isAudio = ["tomp3", "ttaudo", "ttaudio"].includes(cmdLower);

  return handleDownload({ conn, mek, sender: from, url: q, isAudio, footer });
});
