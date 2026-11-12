require('dotenv').config();

const express = require('express');
const http = require('http');
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
app.disable('x-powered-by'); 

// CORS কনফিগারেশন
const allowedOrigins = [
  "http://localhost:3000", 
  "https://socket-io-rouge-gamma.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Payload লিমিট বাড়ানো হলো (ছবি/ভিডিওর জন্য)
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
          if (error) {
            console.error("Cloudinary Stream Error:", error);
            return cb(error);
          }
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

// ফাইল সাইজ লিমিট (Render ক্র্যাশ রোধ করতে)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('অসমর্থিত ফাইল ফরম্যাট!'), false);
  }
};

const upload = multer({ 
  storage: createCloudinaryStorage('chat_app_avatars', 'image'),
  limits: { fileSize: 10 * 1024 * 1024 }, // সর্বোচ্চ 10MB
  fileFilter: fileFilter
});

const uploadAudio = multer({ 
  storage: createCloudinaryStorage('chat_app_audio', 'video'),
  limits: { fileSize: 20 * 1024 * 1024 }, // সর্বোচ্চ 20MB
  fileFilter: fileFilter
});

const uploadVideo = multer({ 
  storage: createCloudinaryStorage('chat_app_videos', 'video'),
  limits: { fileSize: 50 * 1024 * 1024 }, // সর্বোচ্চ 50MB
  fileFilter: fileFilter
});

// ==========================================

app.get('/', (req, res) => {
  res.send('Socket সার্ভার চলছে');
});

// --- বাকি সব API রুট আগের মতোই থাকবে ---
// (এখানে কোড ছোট করার জন্য বাদ দেওয়া হলো, কিন্তু আপনার ফাইলে নিচের রুটগুলো আগের মতোই থাকবে)

app.post('/api/register', async (req, res) => { /* ... আগের কোড ... */ });
app.post('/api/login', async (req, res) => { /* ... আগের কোড ... */ });
app.post('/api/forgot-password', async (req, res) => { /* ... আগের কোড ... */ });
app.post('/api/reset-password', async (req, res) => { /* ... আগের কোড ... */ });
app.post('/api/rooms', async (req, res) => { /* ... আগের কোড ... */ });
app.get('/api/rooms/:userId', async (req, res) => { /* ... আগের কোড ... */ });
app.get('/api/users/:currentUserId', async (req, res) => { /* ... আগের কোড ... */ });
app.post('/api/rooms/private', async (req, res) => { /* ... আগের কোড ... */ });
app.delete('/api/rooms/:roomId', async (req, res) => { /* ... আগের কোড ... */ });
app.put('/api/rooms/:roomId/members', async (req, res) => { /* ... আগের কোড ... */ });
app.delete('/api/rooms/:roomId/members/:memberId', async (req, res) => { /* ... আগের কোড ... */ });
app.put('/api/rooms/:roomId/admins', async (req, res) => { /* ... আগের কোড ... */ });
app.put('/api/users/:userId', async (req, res) => { /* ... আগের কোড ... */ });


// 🚨 আপলোড রুটগুলোতে Error Handling ঠিক করা হলো 🚨
app.post('/api/upload', (req, res) => {
  upload.single('image')(req, res, function (err) {
    if (err) {
      console.error("Cloudinary Upload Error:", err.message);
      return res.status(500).json({ message: 'ছবি আপলোডে সমস্যা!', error: err.message });
    }
    if (!req.file) return res.status(400).json({ message: 'কোনো ছবি আপলোড করা হয়নি' });
    res.status(200).json({ imageUrl: req.file.path });
  });
});

app.post('/api/upload-audio', (req, res) => {
  uploadAudio.single('audio')(req, res, function (err) {
    if (err) {
      console.error("Audio Upload Error:", err.message);
      return res.status(500).json({ message: 'অডিও আপলোডে সমস্যা!', error: err.message });
    }
    if (!req.file) return res.status(400).json({ message: 'কোনো অডিও আপলোড করা হয়নি' });
    res.status(200).json({ audioUrl: req.file.path });
  });
});

app.post('/api/upload-video', (req, res) => {
  uploadVideo.single('video')(req, res, function (err) {
    if (err) {
      console.error("Video Upload Error:", err.message);
      return res.status(500).json({ message: 'ভিডিও আপলোডে সমস্যা!', error: err.message });
    }
    if (!req.file) return res.status(400).json({ message: 'কোনো ভিডিও আপলোড করা হয়নি' });
    res.status(200).json({ videoUrl: req.file.path });
  });
});

// Socket.io এবং MongoDB কানেকশন
const server = http.createServer(app);

const io = new Server(server, { 
  cors: { 
    origin: allowedOrigins, 
    methods: ['GET', 'POST'],
    credentials: true
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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 সার্ভার চলছে পোর্ট ${PORT}-এ`);
});