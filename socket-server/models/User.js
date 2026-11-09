const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  avatar: {
    type: String,
    default: '',
  },
  // নতুন: পাসওয়ার্ড রিসেটের জন্য টোকেন এবং এক্সপায়ারি টাইম
  resetPasswordToken: String,
  resetPasswordExpire: Date,
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);