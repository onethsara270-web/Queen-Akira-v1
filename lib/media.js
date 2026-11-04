// Downloads the bot image once and keeps it in memory, so messages send the image as a Buffer.
// (Sending { url } makes WhatsApp upload fetch the file every time and silently fails when the host is slow.)
const axios = require('axios');

const cache = new Map();

async function getImageBuffer(url) {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url);
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
    const buf = Buffer.from(res.data);
    if (buf.length > 0) { cache.set(url, buf); return buf; }
  } catch (e) {
    console.log('⚠️ Image download failed:', e.message);
  }
  return null;
}

/** { image: Buffer|{url} } — never throws */
async function imageSource(url) {
  const buf = await getImageBuffer(url);
  return buf || { url };
}

module.exports = { getImageBuffer, imageSource };
