
const express = require('express');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { getVideoDurationInSeconds } = require('get-video-duration');
const ffmpeg = require('fluent-ffmpeg');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const { uploadVideoWithThumbnail, handleUploadError } = require('../middleware/upload');
const Video = require('../models/Video');
const User = require('../models/User');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const Subscription = require('../models/Subscription');

const router = express.Router();
const stat = promisify(fs.stat);

// Upload a video
router.post(
  '/upload',
  auth,
  uploadVideoWithThumbnail,
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.files || !req.files.video) {
        return res.status(400).json({ message: 'Video file is required' });
      }

      const videoFile = req.files.video[0];
      const thumbnailFile = req.files.thumbnail ? req.files.thumbnail[0] : null;
      
      // Get video duration
      const videoPath = path.join(__dirname, '../uploads/videos', videoFile.filename);
      const duration = await getVideoDurationInSeconds(videoPath);

      // If no thumbnail was uploaded, generate one from the video
      let thumbnailFilename = '';
      if (!thumbnailFile) {
        thumbnailFilename = `${Date.now()}-thumbnail.jpg`;
        const thumbnailPath = path.join(__dirname, '../uploads/thumbnails', thumbnailFilename);
        
        // Generate thumbnail at 0 seconds (first frame)
        ffmpeg(videoPath)
          .screenshots({
            timestamps: ['00:00:01.000'],
            filename: thumbnailFilename,
            folder: path.join(__dirname, '../uploads/thumbnails'),
            size: '1280x720'
          });
      } else {
        thumbnailFilename = thumbnailFile.filename;
      }

      // Create video document
      const video = new Video({
        title: req.body.title,
        description: req.body.description || '',
        fileName: videoFile.filename,
        thumbnail: thumbnailFilename,
        duration: Math.round(duration),
        category: req.body.category || '',
        creator: req.user._id
      });

      await video.save();

      // Return video data
      await video.populate('creator', 'username');
      res.status(201).json(video);
    } catch (error) {
      console.error('Video upload error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get all videos (with pagination and filters)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const query = { isPrivate: false };
    
    // Filter by category if provided
    if (req.query.category && req.query.category !== 'All') {
      query.category = req.query.category;
    }

    const videos = await Video.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('creator', 'username subscribersCount');

    res.json(videos);
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single video by ID
router.get('/:id', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id)
      .populate('creator', 'username subscribersCount');
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Increment view count
    video.views += 1;
    await video.save();

    // Check if user is authenticated to get like status
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (user) {
          const like = await Like.findOne({
            user: user._id,
            video: video._id
          });
          
          if (like) {
            video._doc.isLiked = like.type === 'like';
            video._doc.isDisliked = like.type === 'dislike';
          }
        }
      } catch (error) {
        // Ignore token errors, just don't add like info
      }
    }

    res.json(video);
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Stream video
router.get('/:id/stream', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const videoPath = path.join(__dirname, '../uploads/videos', video.fileName);
    
    // Check if file exists
    try {
      await stat(videoPath);
    } catch (e) {
      return res.status(404).json({ message: 'Video file not found' });
    }

    // Get file size
    const { size } = await stat(videoPath);
    
    // Parse range header
    const range = req.headers.range;
    
    if (range) {
      // Parse range header
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
      const chunkSize = (end - start) + 1;
      
      // Create read stream
      const fileStream = fs.createReadStream(videoPath, { start, end });
      
      // Set headers
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4'
      });
      
      // Stream file
      fileStream.pipe(res);
    } else {
      // No range header, send entire file
      res.writeHead(200, {
        'Content-Length': size,
        'Content-Type': 'video/mp4'
      });
      
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    console.error('Video streaming error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get video thumbnail
router.get('/:id/thumbnail', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const thumbnailPath = path.join(__dirname, '../uploads/thumbnails', video.thumbnail);
    
    // Check if file exists
    try {
      await stat(thumbnailPath);
    } catch (e) {
      // If thumbnail doesn't exist, return a default thumbnail
      return res.sendFile(path.join(__dirname, '../uploads/default-thumbnail.jpg'));
    }

    res.sendFile(thumbnailPath);
  } catch (error) {
    console.error('Get thumbnail error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Like or dislike a video
router.post('/:id/like', auth, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const { status } = req.body; // 'like', 'dislike', or null (to remove)
    
    // Find existing like/dislike
    const existingLike = await Like.findOne({
      user: req.user._id,
      video: video._id
    });
    
    // Handle like/dislike logic
    if (existingLike) {
      if (!status) {
        // Remove like/dislike
        if (existingLike.type === 'like') {
          video.likes = Math.max(0, video.likes - 1);
        } else if (existingLike.type === 'dislike') {
          video.dislikes = Math.max(0, video.dislikes - 1);
        }
        
        await Like.deleteOne({ _id: existingLike._id });
      } else if (status !== existingLike.type) {
        // Change from like to dislike or vice versa
        if (existingLike.type === 'like') {
          video.likes = Math.max(0, video.likes - 1);
          video.dislikes += 1;
        } else {
          video.dislikes = Math.max(0, video.dislikes - 1);
          video.likes += 1;
        }
        
        existingLike.type = status;
        await existingLike.save();
      }
      // If status is the same as existing, do nothing
    } else if (status) {
      // Create new like/dislike
      const newLike = new Like({
        user: req.user._id,
        video: video._id,
        type: status
      });
      
      if (status === 'like') {
        video.likes += 1;
      } else {
        video.dislikes += 1;
      }
      
      await newLike.save();
    }
    
    await video.save();
    
    res.json({
      likes: video.likes,
      dislikes: video.dislikes,
      status: status || null
    });
  } catch (error) {
    console.error('Video like error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get like status for a video
router.get('/:id/like/status', auth, async (req, res) => {
  try {
    const like = await Like.findOne({
      user: req.user._id,
      video: req.params.id
    });
    
    res.json({
      status: like ? like.type : null
    });
  } catch (error) {
    console.error('Get like status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get videos by a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const videos = await Video.find({
      creator: userId,
      isPrivate: false
    })
      .sort({ createdAt: -1 })
      .populate('creator', 'username');
    
    res.json(videos);
  } catch (error) {
    console.error('Get user videos error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get related videos
router.get('/related/:id', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    // Get videos with same category or from same creator, excluding current video
    const query = {
      _id: { $ne: video._id },
      isPrivate: false,
      $or: [
        { category: video.category && video.category !== '' ? video.category : { $exists: true } },
        { creator: video.creator }
      ]
    };
    
    const relatedVideos = await Video.find(query)
      .sort({ views: -1 })
      .limit(10)
      .populate('creator', 'username');
    
    res.json(relatedVideos);
  } catch (error) {
    console.error('Get related videos error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get videos from subscribed channels
router.get('/subscriptions', auth, async (req, res) => {
  try {
    // Get all subscriptions for the user
    const subscriptions = await Subscription.find({ subscriber: req.user._id });
    
    if (subscriptions.length === 0) {
      return res.json([]);
    }
    
    // Get creator IDs from subscriptions
    const creatorIds = subscriptions.map(sub => sub.creator);
    
    // Get videos from those creators
    const videos = await Video.find({
      creator: { $in: creatorIds },
      isPrivate: false
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('creator', 'username subscribersCount');
    
    res.json(videos);
  } catch (error) {
    console.error('Get subscription videos error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Comments routes
router.get('/:id/comments', async (req, res) => {
  try {
    const comments = await Comment.find({ video: req.params.id })
      .sort({ createdAt: -1 })
      .populate('user', 'username');
    
    // If user is authenticated, add like status to comments
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (user) {
          // Get all likes for this user and these comments
          const commentIds = comments.map(comment => comment._id);
          const likes = await Like.find({
            user: user._id,
            comment: { $in: commentIds }
          });
          
          // Add like status to each comment
          comments.forEach(comment => {
            const like = likes.find(like => 
              like.comment.toString() === comment._id.toString()
            );
            
            comment._doc.isLiked = like && like.type === 'like';
          });
        }
      } catch (error) {
        // Ignore token errors, just don't add like info
      }
    }
    
    res.json(comments);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/comments', auth, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    const { content } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Comment content is required' });
    }
    
    const comment = new Comment({
      video: video._id,
      user: req.user._id,
      content
    });
    
    await comment.save();
    await comment.populate('user', 'username');
    
    res.status(201).json(comment);
  } catch (error) {
    console.error('Post comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
