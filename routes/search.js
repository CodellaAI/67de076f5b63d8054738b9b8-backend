
const express = require('express');
const Video = require('../models/Video');
const User = require('../models/User');

const router = express.Router();

// Search videos and channels
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.json([]);
    }
    
    // Search videos by title and description
    const videos = await Video.find({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ],
      isPrivate: false
    })
      .populate('creator', 'username subscribersCount')
      .sort({ views: -1, createdAt: -1 })
      .limit(20);
    
    // Search users by username
    const users = await User.find({
      username: { $regex: q, $options: 'i' }
    })
      .select('username subscribersCount')
      .sort({ subscribersCount: -1 })
      .limit(5);
    
    // Combine results
    const results = {
      videos,
      users
    };
    
    res.json(videos);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
