
const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 5000
  },
  fileName: {
    type: String,
    required: true
  },
  thumbnail: {
    type: String,
    default: ''
  },
  duration: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  dislikes: {
    type: Number,
    default: 0
  },
  category: {
    type: String,
    enum: ['', 'Music', 'Gaming', 'Sports', 'News', 'Comedy', 'Education', 'Science', 'Technology'],
    default: ''
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPrivate: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Create index for text search
videoSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Video', videoSchema);
