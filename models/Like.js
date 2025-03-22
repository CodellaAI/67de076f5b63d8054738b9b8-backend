
const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  video: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video'
  },
  comment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },
  type: {
    type: String,
    enum: ['like', 'dislike'],
    required: true
  }
}, { timestamps: true });

// Ensure a user can only like/dislike a video or comment once
likeSchema.index({ user: 1, video: 1 }, { unique: true, sparse: true });
likeSchema.index({ user: 1, comment: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Like', likeSchema);
