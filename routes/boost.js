// ============================================================
// 🚀 BOOST ROUTES
// Path: routes/boost.js
// ============================================================
const express = require('express');
const boostManager = require('../lib/boostManager');
const boostStore = require('../lib/boostStore');

module.exports = function createBoostRouter() {
  const router = express.Router();

  // 1. Connected sessions ලැයිස්තුව ගන්න
  router.get('/sessions', (req, res) => {
    try {
      const list = boostManager.listConnectedSessions().map(s => ({
        sessionId: s.sessionId, 
        phone: s.phone
      }));
      res.json({ success: true, sessions: list });
    } catch (e) { 
      res.status(500).json({ success: false, error: e.message }); 
    }
  });

  // 2. React Boost
  router.post('/react', async (req, res) => {
    try {
      const { requesterSessionId, channelLink, postId, emoji } = req.body || {};
      if (!requesterSessionId) return res.status(400).json({ success: false, error: 'requesterSessionId required' });
      
      const r = await boostManager.reactBoost({ requesterSessionId, channelLink, postId, emoji });
      res.json({ success: true, ...r });
    } catch (e) { 
      res.status(400).json({ success: false, error: e.message }); 
    }
  });

  // 3. Poll Vote Boost
  router.post('/poll', async (req, res) => {
    try {
      // ✅ වෙනස: Website එකෙන් එන pollOptionIndex එක මෙතනින් අල්ලගන්නවා
      const { requesterSessionId, channelLink, postId, pollOptionIndex } = req.body || {};
      
      if (!requesterSessionId) {
        return res.status(400).json({ success: false, error: 'requesterSessionId required' });
      }
      
      // ✅ වෙනස: ඒක boostManager එකට යවනවා
      const r = await boostManager.pollBoost({ requesterSessionId, channelLink, postId, pollOptionIndex });
      
      res.json({ success: true, ...r });
    } catch (e) { 
      res.status(400).json({ success: false, error: e.message }); 
    }
  });

  // 4. Followers Boost
  router.post('/follow', async (req, res) => {
    try {
      const { requesterSessionId, channelLink } = req.body || {};
      if (!requesterSessionId) return res.status(400).json({ success: false, error: 'requesterSessionId required' });
      
      const r = await boostManager.followBoost({ requesterSessionId, channelLink });
      res.json({ success: true, ...r });
    } catch (e) { 
      res.status(400).json({ success: false, error: e.message }); 
    }
  });

  // 5. Boost එකක් Revert කිරීම (අවලංගු කිරීම)
  router.post('/revert', async (req, res) => {
    try {
      const { boostId } = req.body || {};
      if (!boostId) return res.status(400).json({ success: false, error: 'boostId required' });
      
      const r = await boostManager.revertBoost(boostId);
      res.json({ success: true, ...r });
    } catch (e) { 
      res.status(400).json({ success: false, error: e.message }); 
    }
  });

  // 6. Boost History එක ගන්න
  router.get('/list', async (req, res) => {
    try {
      const list = await boostStore.list({ requesterSessionId: req.query.requesterSessionId, limit: 50 });
      res.json({ success: true, boosts: list });
    } catch (e) { 
      res.status(500).json({ success: false, error: e.message }); 
    }
  });

  return router;
};
