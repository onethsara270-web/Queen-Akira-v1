// Builds a sendable content object from the replied message (image / video / audio) or plain text.
const { downloadContentFromMessage } = require('fixo-baileys');

const TYPES = { imageMessage: 'image', videoMessage: 'video', audioMessage: 'audio' };

async function buildContent(m, text) {
    const q = m.quoted;
    const kind = q && TYPES[q.mtype];
    if (kind) {
        const stream = await downloadContentFromMessage(q, kind);
        let buf = Buffer.from([]);
        for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
        const content = { [kind]: buf };
        const caption = text || q.caption || '';
        if (kind !== 'audio' && caption) content.caption = caption;
        if (kind === 'audio') { content.mimetype = 'audio/mp4'; content.ptt = !!q.ptt; }
        return content;
    }
    // sent media with the command as its caption is handled by the caller via m.mtype
    if (TYPES[m.mtype]) {
        const kind2 = TYPES[m.mtype];
        const stream = await downloadContentFromMessage(m.msg, kind2);
        let buf = Buffer.from([]);
        for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
        const content = { [kind2]: buf };
        if (kind2 !== 'audio' && text) content.caption = text;
        return content;
    }
    if (text) return { text };
    return null;
}

module.exports = { buildContent };
