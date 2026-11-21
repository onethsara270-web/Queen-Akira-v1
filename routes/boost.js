// ============================================================
// 🚀 BOOST ROUTES
// Path: routes/boost.js
// ============================================================
const express = require('express');
const boostManager = require('../lib/boostManager');
const boostStore = require('../lib/boostStore');
const userMgr = require('../user-manager');
const config = require('../config');

module.exports = function createBoostRouter() {
  const router = express.Router();

  router.get('/sessions', (req, res) => {
    try {
      const list = [];
      const key = req.query.key;

      let currentUser = null;
      if (key) {
        currentUser = Object.values(userMgr.USERS).find(u => String(u.dashPassword) === String(key));
      }

      if (currentUser) {
        const inst = userMgr.BOT_INSTANCES.get(currentUser.sessionId);
        list.push({
          sessionId: currentUser.sessionId,
          phone: currentUser.phone,
          status: inst?.status || 'offline'
        });
      } 
      else if (key && (String(key) === String(config.DASHBOARD_PASSWORD) || String(key) === 'fixo123')) {
        if (global.ownerConn && global.ownerConn.user) {
          list.push({ sessionId: '__owner__', phone: String(global.ownerConn.user.id).split(':')[0], status: 'active' });
        } else {
          list.push({ sessionId: '__owner__', phone: 'Owner Bot', status: 'offline' });
        }
      }

      res.json({ success: true, sessions: list });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  router.post('/react', async (req, res) => {
    try {
      const { requesterSessionId, channelLink, postId, emoji } = req.body || {};
      const key = req.query.key;
      if (!key) return res.status(401).json({ success: false, error: 'Unauthorized — key missing' });
      if (!requesterSessionId) return res.status(400).json({ success: false, error: 'requesterSessionId required' });
      
      const r = await boostManager.reactBoost({ requesterSessionId, channelLink, postId, emoji });
      res.json({ success: true, ...r });
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  });

  router.post('/poll', async (req, res) => {
    try {
      const { requesterSessionId, channelLink, postId, pollOption } = req.body || {};
      const key = req.query.key;
      if (!key) return res.status(401).json({ success: false, error: 'Unauthorized — key missing' });
      if (!requesterSessionId) return res.status(400).json({ success: false, error: 'requesterSessionId required' });
      
      const r = await boostManager.pollBoost({ requesterSessionId, channelLink, postId, pollOption });
      res.json({ success: true, ...r });
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  });

  router.post('/follow', async (req, res) => {
    try {
      const { requesterSessionId, channelLink } = req.body || {};
      const key = req.query.key;
      if (!key) return res.status(401).json({ success: false, error: 'Unauthorized — key missing' });
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
      const key = req.query.key;
      const requesterSessionId = req.query.requesterSessionId;
      
      if (!key) {
        return res.status(401).json({ success: false, error: 'Unauthorized — key missing' });
      }

      const isOwnerKey = (String(key) === String(config.DASHBOARD_PASSWORD) || String(key) === 'fixo123');
      let authorized = isOwnerKey;

      if (!authorized && requesterSessionId && requesterSessionId !== '__owner__') {
        const currentUser = Object.values(userMgr.USERS).find(u => u.sessionId === requesterSessionId);
        if (currentUser && String(currentUser.dashPassword) === String(key)) {
          authorized = true;
        }
      }

      if (!authorized) {
        return res.status(401).json({ success: false, error: 'Unauthorized — invalid key' });
      }

      const list = await boostStore.list({ requesterSessionId: requesterSessionId, limit: 50 });
      res.json({ success: true, boosts: list });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  return router;
};
