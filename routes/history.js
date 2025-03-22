
const express = require('express');
const auth = require('../middleware/auth');
const History = require('../models/History');

const router = express.Router();

// Add video to history
router.post('/', auth, async (req, res) => {
  try {
    const { videoId } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ message: 'Video ID is required' });
    }
    
    // Check if video is already in history
    const existingEntry = await History.findOne({
      user: req.user._id,
      video: videoId
    });
    
    if (existingEntry) {
      // Update timestamp
      existingEntry.watchedAt = Date.now();
      await existingEntry.save();
      
      return res.json(existingEntry);
    }
    
    // Create new history entry
    const historyEntry = new History({
      user: req.user._id,
      video: videoId
    });
    
    await historyEntry.save();
    
    res.status(201).json(historyEntry);
  } catch (error) {
    console.error('Add to history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's watch history
router.get('/', auth, async (req, res) => {
  try {
    const history = await History.find({ user: req.user._id })
      .sort({ watchedAt: -1 })
      .populate({
        path: 'video',
        populate: {
          path: 'creator',
          select: 'username'
        }
      });
    
    res.json(history);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Clear watch history
router.delete('/', auth, async (req, res) => {
  try {
    await History.deleteMany({ user: req.user._id });
    
    res.json({ message: 'Watch history cleared successfully' });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove specific video from history
router.delete('/:videoId', auth, async (req, res) => {
  try {
    await History.deleteOne({
      user: req.user._id,
      video: req.params.videoId
    });
    
    res.json({ message: 'Video removed from history' });
  } catch (error) {
    console.error('Remove from history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
