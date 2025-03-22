
const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  video: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: true
  },
  watchedAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure each video appears only once in a user's history (but can update the timestamp)
historySchema.index({ user: 1, video: 1 }, { unique: true });

module.exports = mongoose.model('History', historySchema);
