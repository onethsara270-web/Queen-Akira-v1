// ============================================================
// 📢 BOOST STORE — MongoDB persistence
// Path: lib/boostStore.js
// Collection: qam_boosts
// ============================================================
const mongo = require('./mongo');
const { ObjectId } = require('mongodb');

const COLL = 'qam_boosts';

function db() {
  if (!mongo.isConnected()) throw new Error('MongoDB not connected');
  return mongo.getDB();
}

async function ensureIndexes() {
  try {
    const col = db().collection(COLL);
    await col.createIndex({ requesterSessionId: 1, status: 1 });
    await col.createIndex({ channelJid: 1, status: 1 });
    await col.createIndex({ 'participants.sessionId': 1, status: 1 });
    await col.createIndex({ status: 1, lastActiveAt: -1 });
    console.log('📇 boostStore indexes created');
  } catch (e) { console.error('⚠️ boostStore index:', e.message); }
}

async function create(data) {
  const doc = {
    requesterSessionId: data.requesterSessionId,
    requesterPhone: data.requesterPhone || null,
    channelJid: data.channelJid,
    channelLink: data.channelLink || null,
    channelName: data.channelName || null,
    actionType: data.actionType,
    postId: data.postId || null,
    emoji: data.emoji || null,
    pollOption: data.pollOption || null,
    participants: data.participants || [],
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActiveAt: new Date()
  };
  const r = await db().collection(COLL).insertOne(doc);
  return { ...doc, _id: r.insertedId };
}

async function getActiveByRequester(requesterSessionId) {
  return db().collection(COLL).find({ requesterSessionId, status: 'active' }).toArray();
}

async function getActiveByParticipant(sessionId) {
  return db().collection(COLL).find({ status: 'active', 'participants.sessionId': sessionId }).toArray();
}

async function getAllActive() {
  return db().collection(COLL).find({ status: 'active' }).toArray();
}

async function getById(id) {
  try { return await db().collection(COLL).findOne({ _id: new ObjectId(id) }); }
  catch (e) { return null; }
}

async function list({ requesterSessionId, limit = 50 } = {}) {
  const filter = {};
  if (requesterSessionId) filter.requesterSessionId = requesterSessionId;
  return db().collection(COLL).find(filter).sort({ createdAt: -1 }).limit(limit).toArray();
}

async function updateStatus(id, status) {
  await db().collection(COLL).updateOne(
    { _id: new ObjectId(id) },
    { $set: { status, updatedAt: new Date() } }
  );
}

async function touch(id) {
  await db().collection(COLL).updateOne(
    { _id: new ObjectId(id) },
    { $set: { lastActiveAt: new Date() } }
  );
}

module.exports = {
  ensureIndexes, create, getActiveByRequester, getActiveByParticipant,
  getAllActive, getById, list, updateStatus, touch
};
