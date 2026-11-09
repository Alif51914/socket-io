require('dotenv').config();

const express = require('express');
const http = require('http'); // HTTPS এর বদলে HTTP ব্যবহার করছি
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto'); 

const Message = require('./models/Message');
const User = require('./models/User');
const Room = require('./models/Room');

const app = express();

// Hide the 'X-Powered-By: Express' header
app.disable('x-powered-by'); 

app.use(cors());
app.use(express.json()); 
app.use(helmet({
  contentSecurityPolicy: false, 
  crossOriginResourcePolicy: false, 
}));

// Cloudinary কনফিগারেশন
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==========================================
// কাস্টম MULTER STORAGE ENGINE FOR CLOUDINARY
// ==========================================
const createCloudinaryStorage = (folder, resourceType = 'auto') => {
  return {
    _handleFile: (req, file, cb) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: folder, resource_type: resourceType },
        (error, result) => {
          if (error) return cb(error);
          cb(null, { path: result.secure_url, filename: result.public_id });
        }
      );
      file.stream.pipe(uploadStream);
    },
    _removeFile: (req, file, cb) => {
      cb(null);
    }
  };
};

const upload = multer({ storage: createCloudinaryStorage('chat_app_avatars', 'image') });
const uploadAudio = multer({ storage: createCloudinaryStorage('chat_app_audio', 'video') });
const uploadVideo = multer({ storage: createCloudinaryStorage('chat_app_videos', 'video') });
// ==========================================

// ১. টেস্ট রুট
app.get('/', (req, res) => {
  res.send('Socket সার্ভার চলছে');
});

// ২. রেজিস্ট্রেশন API
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: 'সব তথ্য দিতে হবে' });

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) return res.status(400).json({ message: 'এই ইউজারনেম বা ইমেইল আগেই ব্যবহৃত হয়েছে' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({
      message: 'ইউজার সফলভাবে তৈরি হয়েছে',
      user: { _id: newUser._id, username: newUser.username, email: newUser.email },
    });
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার এরর!' });
  }
});

// ৩. লগইন API
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'ইমেইল এবং পাসওয়ার্ড দুটোই দিতে হবে' });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'ভুল ইমেইল বা পাসওয়ার্ড' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'ভুল ইমেইল বা পাসওয়ার্ড' });

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({
      message: 'লগইন সফল হয়েছে',
      token,
      user: { _id: user._id, username: user.username, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার এরর!' });
  }
});

// ৪. পাসওয়ার্ড ফরগেট API 
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট নেই' });

    const resetToken = crypto.randomBytes(20).toString('hex');

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = Date.now() + 3600000;
    await user.save();

    console.log('\n=========================================');
    console.log(`Password Reset Token for ${email}:`);
    console.log(`➡️ ${resetToken}`);
    console.log('=========================================\n');

    res.status(200).json({ message: 'রিসেট টোকেন তৈরি হয়েছে! সার্ভারের টার্মিনালে টোকেনটি দেখুন।' });
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার এরর!' });
  }
});

// ৫. পাসওয়ার্ড রিসেট API
app.post('/api/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'টোকেন এবং নতুন পাসওয়ার্ড দুটোই দিতে হবে' });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() } 
    });

    if (!user) return res.status(400).json({ message: 'টোকেনটি ভুল অথবা মেয়াদোত্তীর্ণ হয়েছে!' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({ message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে! এখন লগইন করুন।' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'সার্ভার এরর!' });
  }
});

// ৬. ছবি আপলোড API
app.post('/api/upload', (req, res) => {
  upload.single('image')(req, res, function (err) {
    if (err) {
      console.error("Cloudinary Upload Error:", err);
      return res.status(500).json({ message: 'ছবি আপলোডে সমস্যা হয়েছে!', error: err.message });
    }
    try {
      if (!req.file) return res.status(400).json({ message: 'কোনো ছবি আপলোড করা হয়নি' });
      res.status(200).json({ imageUrl: req.file.path });
    } catch (error) {
      res.status(500).json({ message: 'সার্ভার এরর!' });
    }
  });
});

// ৭. অডিও আপলোড API
app.post('/api/upload-audio', (req, res) => {
  uploadAudio.single('audio')(req, res, function (err) {
    if (err) {
      console.error("Audio Upload Error:", err);
      return res.status(500).json({ message: 'অডিও আপলোডে সমস্যা!', error: err.message });
    }
    try {
      if (!req.file) return res.status(400).json({ message: 'কোনো অডিও আপলোড করা হয়নি' });
      res.status(200).json({ audioUrl: req.file.path });
    } catch (error) {
      res.status(500).json({ message: 'সার্ভার এরর!' });
    }
  });
});

// ৮. ভিডিও আপলোড API
app.post('/api/upload-video', (req, res) => {
  uploadVideo.single('video')(req, res, function (err) {
    if (err) {
      console.error("Video Upload Error:", err);
      return res.status(500).json({ message: 'ভিডিও আপলোডে সমস্যা!', error: err.message });
    }
    try {
      if (!req.file) return res.status(400).json({ message: 'কোনো ভিডিও আপলোড করা হয়নি' });
      res.status(200).json({ videoUrl: req.file.path });
    } catch (error) {
      res.status(500).json({ message: 'সার্ভার এরর!' });
    }
  });
});

// ৯. নতুন গ্রুপ রুম তৈরি
app.post('/api/rooms', async (req, res) => {
  try {
    const { name, userId, memberIds } = req.body;
    if (!name || !userId) return res.status(400).json({ message: 'রুমের নাম এবং ইউজার আইডি দিতে হবে' });

    const allMembers = [...new Set([userId, ...(memberIds || [])])];
    const newRoom = new Room({ name, createdBy: userId, admins: [userId], members: allMembers });

    await newRoom.save();
    res.status(201).json({ message: 'গ্রুপ তৈরি হয়েছে', room: newRoom });
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার এরর!' });
  }
});

// ১০. নির্দিষ্ট ইউজারের রুম লিস্ট
app.get('/api/rooms/:userId', async (req, res) => {
  try {
    const rooms = await Room.find({ members: req.params.userId }).sort({ createdAt: -1 });
    res.status(200).json(rooms);
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার এরর!' });
  }
});

// ১১. সব ইউজারের লিস্ট
app.get('/api/users/:currentUserId', async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.params.currentUserId } }).select('-password');
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: 'ইউজার লিস্ট আনতে সমস্যা!' });
  }
});

// ১২. প্রাইভেট রুম তৈরি বা খোঁজা
app.post('/api/rooms/private', async (req, res) => {
  try {
    const { user1Id, user2Id } = req.body;
    if (!mongoose.Types.ObjectId.isValid(user1Id) || !mongoose.Types.ObjectId.isValid(user2Id)) {
      return res.status(400).json({ message: 'ভুল ইউজার আইডি!' });
    }

    let room = await Room.findOne({ name: 'Private Chat', members: { $all: [user1Id, user2Id] } });
    if (!room) {
      room = new Room({ name: 'Private Chat', createdBy: user1Id, members: [user1Id, user2Id] });
      await room.save();
    }
    res.status(200).json(room);
  } catch (err) {
    res.status(500).json({ message: 'প্রাইভেট রুম তৈরি করতে সমস্যা!' });
  }
});

// ১৩. গ্রুপ ডিলিট
app.delete('/api/rooms/:roomId', async (req, res) => {
  try {
    const { userId } = req.body;
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'রুম পাওয়া যায়নি' });
    if (String(room.createdBy) !== String(userId)) return res.status(403).json({ message: 'শুধু ক্রিয়েটর গ্রুপ ডিলিট করতে পারবে!' });

    await Room.findByIdAndDelete(req.params.roomId);
    res.status(200).json({ message: 'গ্রুপ ডিলিট হয়েছে' });
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার এরর!' });
  }
});

// ১৪. মেম্বার অ্যাড
app.put('/api/rooms/:roomId/members', async (req, res) => {
  try {
    const { userId, newMemberId } = req.body;
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'রুম পাওয়া যায়নি' });
    if (!room.admins.includes(userId)) return res.status(403).json({ message: 'শুধু অ্যাডমিন মেম্বার অ্যাড করতে পারবে!' });

    if (!room.members.includes(newMemberId)) {
      room.members.push(newMemberId);
      await room.save();
    }
    res.status(200).json({ message: 'মেম্বার অ্যাড হয়েছে', room });
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার এরর!' });
  }
});

// ১৫. মেম্বার রিমুভ
app.delete('/api/rooms/:roomId/members/:memberId', async (req, res) => {
  try {
    const { userId } = req.body;
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'রুম পাওয়া যায়নি' });
    if (!room.admins.includes(userId)) return res.status(403).json({ message: 'শুধু অ্যাডমিন মেম্বার রিমুভ করতে পারবে!' });
    if (String(room.createdBy) === String(req.params.memberId)) return res.status(400).json({ message: 'ক্রিয়েটরকে রিমুভ করা যাবে না!' });

    room.members = room.members.filter(m => String(m) !== String(req.params.memberId));
    room.admins = room.admins.filter(a => String(a) !== String(req.params.memberId));
    await room.save();

    res.status(200).json({ message: 'মেম্বার রিমুভ হয়েছে', room });
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার এরর!' });
  }
});

// ১৬. নতুন অ্যাডমিন বানানো
app.put('/api/rooms/:roomId/admins', async (req, res) => {
  try {
    const { userId, newAdminId } = req.body;
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'রুম পাওয়া যায়নি' });
    if (!room.admins.includes(userId)) return res.status(403).json({ message: 'শুধু অ্যাডমিন নতুন অ্যাডমিন বানাতে পারবে!' });

    if (!room.admins.includes(newAdminId)) {
      room.admins.push(newAdminId);
      await room.save();
    }
    res.status(200).json({ message: 'নতুন অ্যাডমিন তৈরি হয়েছে', room });
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার এরর!' });
  }
});

// ১৭. প্রোফাইল আপডেট
app.put('/api/users/:userId', async (req, res) => {
  try {
    const { username, avatar } = req.body;
    const userId = req.params.userId;

    if (username) {
      const existingUser = await User.findOne({ username, _id: { $ne: userId } });
      if (existingUser) return res.status(400).json({ message: 'এই ইউজারনেম আগেই ব্যবহৃত হয়েছে' });
    }

    const updatedUser = await User.findByIdAndUpdate(userId, { $set: { username, avatar } }, { new: true }).select('-password');
    res.status(200).json({ message: 'প্রোফাইল আপডেট হয়েছে', user: updatedUser });
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার এরর!' });
  }
});

const server = http.createServer(app);

const io = new Server(server, { 
  cors: { 
    origin: process.env.CLIENT_URL || 'http://localhost:3000', 
    methods: ['GET', 'POST'] 
  } 
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB কানেক্ট হয়েছে'))
  .catch((err) => console.error('❌ MongoDB কানেকশন এরর:', err));

let onlineUsers = {};

io.on('connection', (socket) => {
  console.log('✅ একজন ইউজার কানেক্ট হয়েছে:', socket.id);

  socket.on('user_connected', (userId) => {
    onlineUsers[userId] = socket.id;
    io.emit('online_users_list', Object.keys(onlineUsers)); 
  });

  socket.on('join_room', async (roomId) => {
    socket.join(roomId);
    try {
      const previousMessages = await Message.find({ roomId }).sort({ createdAt: 1 });
      socket.emit('previous_messages', previousMessages);
    } catch (err) {
      console.error('পুরনো মেসেজ লোড করতে সমস্যা:', err);
    }
  });

  socket.on('send_message', async (data) => {
    const { roomId, senderId, text, imageUrl, audioUrl, videoUrl } = data;
    try {
      const newMessage = await Message.create({ roomId, senderId, text, imageUrl, audioUrl, videoUrl });
      io.to(roomId).emit('receive_message', newMessage);
    } catch (err) {
      console.error('মেসেজ সেভ করতে সমস্যা:', err);
    }
  });

  socket.on('disconnect', () => {
    for (const userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        delete onlineUsers[userId];
        break;
      }
    }
    io.emit('online_users_list', Object.keys(onlineUsers));
    console.log('❌ ইউজার ডিসকানেক্ট হয়েছে:', socket.id);
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`🚀 সার্ভার চলছে পোর্ট ${PORT}-এ`);
});