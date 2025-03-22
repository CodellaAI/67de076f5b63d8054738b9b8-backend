
const express = require('express');
const auth = require('../middleware/auth');
const Subscription = require('../models/Subscription');
const User = require('../models/User');

const router = express.Router();

// Subscribe to a channel
router.post('/', auth, async (req, res) => {
  try {
    const { creatorId } = req.body;
    
    if (!creatorId) {
      return res.status(400).json({ message: 'Creator ID is required' });
    }
    
    // Check if creator exists
    const creator = await User.findById(creatorId);
    if (!creator) {
      return res.status(404).json({ message: 'Creator not found' });
    }
    
    // Check if user is trying to subscribe to themselves
    if (req.user._id.toString() === creatorId) {
      return res.status(400).json({ message: 'You cannot subscribe to yourself' });
    }
    
    // Check if subscription already exists
    const existingSubscription = await Subscription.findOne({
      subscriber: req.user._id,
      creator: creatorId
    });
    
    if (existingSubscription) {
      return res.status(400).json({ message: 'Already subscribed to this channel' });
    }
    
    // Create subscription
    const subscription = new Subscription({
      subscriber: req.user._id,
      creator: creatorId
    });
    
    await subscription.save();
    
    // Increment creator's subscriber count
    creator.subscribersCount += 1;
    await creator.save();
    
    res.status(201).json({
      message: 'Subscribed successfully',
      subscription
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Unsubscribe from a channel
router.delete('/:creatorId', auth, async (req, res) => {
  try {
    const creatorId = req.params.creatorId;
    
    // Check if subscription exists
    const subscription = await Subscription.findOne({
      subscriber: req.user._id,
      creator: creatorId
    });
    
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    
    // Delete subscription
    await Subscription.deleteOne({ _id: subscription._id });
    
    // Decrement creator's subscriber count
    const creator = await User.findById(creatorId);
    if (creator) {
      creator.subscribersCount = Math.max(0, creator.subscribersCount - 1);
      await creator.save();
    }
    
    res.json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check if user is subscribed to a channel
router.get('/check/:creatorId', auth, async (req, res) => {
  try {
    const creatorId = req.params.creatorId;
    
    const subscription = await Subscription.findOne({
      subscriber: req.user._id,
      creator: creatorId
    });
    
    res.json({ isSubscribed: !!subscription });
  } catch (error) {
    console.error('Check subscription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's subscriptions
router.get('/', auth, async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ subscriber: req.user._id })
      .populate('creator', 'username subscribersCount avatar');
    
    res.json(subscriptions);
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
