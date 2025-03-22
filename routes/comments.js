
const express = require('express');
const auth = require('../middleware/auth');
const Comment = require('../models/Comment');
const Like = require('../models/Like');

const router = express.Router();

// Update a comment
router.put('/:id', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Check if user is the comment owner
    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this comment' });
    }
    
    // Update content
    const { content } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Comment content is required' });
    }
    
    comment.content = content;
    comment.edited = true;
    
    await comment.save();
    await comment.populate('user', 'username');
    
    res.json(comment);
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a comment
router.delete('/:id', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Check if user is the comment owner
    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }
    
    // Delete comment likes
    await Like.deleteMany({ comment: comment._id });
    
    // Delete comment
    await Comment.deleteOne({ _id: comment._id });
    
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Like or unlike a comment
router.post('/:id/like', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    const { action } = req.body; // 'like' or 'unlike'
    
    // Find existing like
    const existingLike = await Like.findOne({
      user: req.user._id,
      comment: comment._id
    });
    
    if (action === 'like') {
      if (!existingLike) {
        // Create new like
        const newLike = new Like({
          user: req.user._id,
          comment: comment._id,
          type: 'like'
        });
        
        await newLike.save();
        
        // Increment comment likes
        comment.likes += 1;
        await comment.save();
      }
    } else if (action === 'unlike') {
      if (existingLike) {
        // Remove like
        await Like.deleteOne({ _id: existingLike._id });
        
        // Decrement comment likes
        comment.likes = Math.max(0, comment.likes - 1);
        await comment.save();
      }
    }
    
    res.json({ likes: comment.likes });
  } catch (error) {
    console.error('Comment like error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
