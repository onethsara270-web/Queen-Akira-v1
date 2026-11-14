// ============================================================
// 🚀 BOOST ROUTES
// Path: routes/boost.js
// ============================================================
const express = require('express');
const boostManager = require('../lib/boostManager');
const boostStore = require('../lib/boostStore');
const userMgr = require('../user-manager');

module.exports = function createBoostRouter() {
  const router = express.Router();

  router.get('/sessions', (req, res) => {
    try {
      const list = [];
      
      // 1. Owner Bot
      if (global.ownerConn && global.ownerConn.user) {
        list.push({ sessionId: '__owner__', phone: String(global.ownerConn.user.id).split(':')[0], status: 'active' });
      } else {
        list.push({ sessionId: '__owner__', phone: 'Owner Bot', status: 'offline' });
      }

      // 2. User Bots (ඔෆ්ලයින් උනත් ලිස්ට් එකට ගන්නවා)
      for (const user of Object.values(userMgr.USERS)) {
        const inst = userMgr.BOT_INSTANCES.get(user.sessionId);
        list.push({
          sessionId: user.sessionId,
          phone: user.phone,
          status: inst?.status || 'offline' // active, connecting, offline
        });
      }

      res.json({ success: true, sessions: list });
    } catch (e) { 
      res.status(500).json({ success: false, error: e.message }); 
    }
  });

  router.post('/react', async (req, res) => {
    try {
      const { requesterSessionId, channelLink, postId, emoji } = req.body || {};
      if (!requesterSessionId) return res.status(400).json({ success: false, error: 'requesterSessionId required' });
      const r = await boostManager.reactBoost({ requesterSessionId, channelLink, postId, emoji });
      res.json({ success: true, ...r });
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  });

  router.post('/poll', async (req, res) => {
    try {
      const { requesterSessionId, channelLink, postId, pollOption } = req.body || {};
      if (!requesterSessionId) return res.status(400).json({ success: false, error: 'requesterSessionId required' });
      const r = await boostManager.pollBoost({ requesterSessionId, channelLink, postId, pollOption });
      res.json({ success: true, ...r });
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  });

  router.post('/follow', async (req, res) => {
    try {
      const { requesterSessionId, channelLink } = req.body || {};
      if (!requesterSessionId) return res.status(400).json({ success: false, error: 'requesterSessionId required' });
      const r = await boostManager.followBoost({ requesterSessionId, channelLink });
      res.json({ success: true, ...r });
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  });

  router.post('/revert', async (req, res) => {
    try {
      const { boostId } = req.body || {};
      if (!boostId) return res.status(400).json({ success: false, error: 'boostId required' });
      const r = await boostManager.revertBoost(boostId);
      res.json({ success: true, ...r });
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  });

  router.get('/list', async (req, res) => {
    try {
      const list = await boostStore.list({ requesterSessionId: req.query.requesterSessionId, limit: 50 });
      res.json({ success: true, boosts: list });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  return router;
};
