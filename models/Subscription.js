
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  subscriber: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// Ensure a user can only subscribe to a creator once
subscriptionSchema.index({ subscriber: 1, creator: 1 }, { unique: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
