// ==============================================================================
// Student Micro-Credential Verification Engine - Activity Routes
// ==============================================================================

const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  createActivity,
  getMyActivities,
  getActivityById,
  updateActivity,
  deleteActivity
} = require('../controllers/activityController');

const router = express.Router();

// All activity routes require authentication
router.post('/', requireAuth, createActivity);
router.get('/', requireAuth, getMyActivities);
router.get('/me', requireAuth, getMyActivities);
router.get('/:id', requireAuth, getActivityById);
router.put('/:id', requireAuth, updateActivity);
router.delete('/:id', requireAuth, deleteActivity);

module.exports = router;
