
const express = require('express');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const auth = require('../middleware/auth');
const { uploadAvatar, handleUploadError } = require('../middleware/upload');
const User = require('../models/User');
const Video = require('../models/Video');
const Subscription = require('../models/Subscription');

const router = express.Router();
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = req.user;
    const userData = user.toObject();
    delete userData.password;
    
    res.json(userData);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put(
  '/profile',
  auth,
  uploadAvatar.single('avatar'),
  handleUploadError,
  async (req, res) => {
    try {
      const user = req.user;
      
      // Update username if provided
      if (req.body.username) {
        // Check if username is already taken by another user
        const existingUser = await User.findOne({ 
          username: req.body.username,
          _id: { $ne: user._id }
        });
        
        if (existingUser) {
          return res.status(400).json({ message: 'Username already taken' });
        }
        
        user.username = req.body.username;
      }
      
      // Update bio if provided
      if (req.body.bio !== undefined) {
        user.bio = req.body.bio;
      }
      
      // Update avatar if provided
      if (req.file) {
        // Delete old avatar if it exists
        if (user.avatar) {
          const oldAvatarPath = path.join(__dirname, '../uploads/avatars', user.avatar);
          try {
            await stat(oldAvatarPath);
            await unlink(oldAvatarPath);
          } catch (error) {
            // Ignore errors if file doesn't exist
          }
        }
        
        user.avatar = req.file.filename;
      }
      
      await user.save();
      
      const userData = user.toObject();
      delete userData.password;
      
      res.json(userData);
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Update password
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }
    
    // Verify current password
    const isMatch = await req.user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Validate new password
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }
    
    // Update password
    req.user.password = newPassword;
    await req.user.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete account
router.delete('/account', auth, async (req, res) => {
  try {
    const user = req.user;
    
    // Delete user's videos
    const videos = await Video.find({ creator: user._id });
    
    for (const video of videos) {
      // Delete video file
      if (video.fileName) {
        const videoPath = path.join(__dirname, '../uploads/videos', video.fileName);
        try {
          await stat(videoPath);
          await unlink(videoPath);
        } catch (error) {
          // Ignore errors if file doesn't exist
        }
      }
      
      // Delete thumbnail
      if (video.thumbnail) {
        const thumbnailPath = path.join(__dirname, '../uploads/thumbnails', video.thumbnail);
        try {
          await stat(thumbnailPath);
          await unlink(thumbnailPath);
        } catch (error) {
          // Ignore errors if file doesn't exist
        }
      }
    }
    
    // Delete videos from database
    await Video.deleteMany({ creator: user._id });
    
    // Delete avatar
    if (user.avatar) {
      const avatarPath = path.join(__dirname, '../uploads/avatars', user.avatar);
      try {
        await stat(avatarPath);
        await unlink(avatarPath);
      } catch (error) {
        // Ignore errors if file doesn't exist
      }
    }
    
    // Delete subscriptions
    await Subscription.deleteMany({ 
      $or: [
        { subscriber: user._id },
        { creator: user._id }
      ]
    });
    
    // Update subscriber counts for creators user was subscribed to
    const subscriptions = await Subscription.find({ subscriber: user._id });
    for (const sub of subscriptions) {
      const creator = await User.findById(sub.creator);
      if (creator) {
        creator.subscribersCount = Math.max(0, creator.subscribersCount - 1);
        await creator.save();
      }
    }
    
    // Delete user
    await User.deleteOne({ _id: user._id });
    
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by ID (public profile)
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return public profile
    const publicProfile = user.getPublicProfile();
    
    res.json(publicProfile);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user avatar
router.get('/:id/avatar', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!user.avatar) {
      // Return default avatar
      return res.sendFile(path.join(__dirname, '../uploads/default-avatar.png'));
    }
    
    const avatarPath = path.join(__dirname, '../uploads/avatars', user.avatar);
    
    // Check if file exists
    try {
      await stat(avatarPath);
    } catch (e) {
      // If avatar doesn't exist, return a default avatar
      return res.sendFile(path.join(__dirname, '../uploads/default-avatar.png'));
    }
    
    res.sendFile(avatarPath);
  } catch (error) {
    console.error('Get avatar error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
