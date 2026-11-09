const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    trim: true,
  },
  imageUrl: {
    type: String,
  },
  audioUrl: {
    type: String,
  },
  videoUrl: {
    type: String, // নতুন: ভিডিওর লিংক
  },
  reactions: [{
    userId: { type: String },
    emoji: { type: String }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);