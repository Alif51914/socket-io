'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { getSocket } from '@/lib/socket';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Image as ImageIcon, Video, Mic, Square, Smile, Edit, LogOut, Plus, X } from 'lucide-react';

const EMOJIS = ['😀', '😂', '❤️', '👍', '🔥', '😮', '😢', '🙏'];

// লোকালহোস্টের জন্য HTTP (ডিপ্লয়ের সময় এখানে .env থেকে লিংক নিতে পারিস)
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export default function Home() {
  const [connected, setConnected] = useState(false);
  
  // Auth States
  const [isLogin, setIsLogin] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false); 
  const [forgotStep, setForgotStep] = useState(1); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); 
  const [username, setUsername] = useState('');
  const [user, setUser] = useState(null); 
  
  // Reset Password States
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Data States
  const [rooms, setRooms] = useState([]); 
  const [usersList, setUsersList] = useState([]); 
  const [onlineUsers, setOnlineUsers] = useState([]); 
  const [newRoomName, setNewRoomName] = useState(''); 
  const [isCreatingGroup, setIsCreatingGroup] = useState(false); 
  const [selectedMembers, setSelectedMembers] = useState([]); 
  const [activeRoom, setActiveRoom] = useState(null); 
  
  // Chat & Manage Group States
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const [showManageGroup, setShowManageGroup] = useState(false); 
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Profile Edit States
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  
  // Loading & Recording States
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const messagesEndRef = useRef(null);
  const chatFileInputRef = useRef(null);
  const chatVideoInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const savedUser = localStorage.getItem('chatUser');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
        getSocket().connect();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const socket = getSocket();

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('receive_message', (newMessage) => {
      if (activeRoom && newMessage.roomId === activeRoom._id) {
        setMessages((prev) => [...prev, newMessage]);
      }
    });

    socket.on('previous_messages', (prevMsgs) => setMessages(prevMsgs));
    socket.on('online_users_list', (users) => setOnlineUsers(users));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('receive_message');
      socket.off('previous_messages');
      socket.off('online_users_list');
    };
  }, [activeRoom]); 

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (user) {
      const socket = getSocket();
      socket.emit('user_connected', user._id);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      try {
        const roomsRes = await fetch(`${API_URL}/api/rooms/${user._id}`);
        setRooms(await roomsRes.json());

        const usersRes = await fetch(`${API_URL}/api/users/${user._id}`);
        setUsersList(await usersRes.json());
      } catch (err) { console.error('ডেটা আনতে সমস্যা:', err); }
    };
    loadData();
  }, [user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    const url = isLogin ? `${API_URL}/api/login` : `${API_URL}/api/register`;
    const body = isLogin ? { email, password } : { username, email, password };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        setUser(data.user); 
        localStorage.setItem('chatUser', JSON.stringify(data.user));
        getSocket().connect(); 
      } else { alert(data.message); }
    } catch (err) { alert('সার্ভার কানেক্ট করা যাচ্ছে না!'); }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setForgotStep(2);
      } else { alert(data.message); }
    } catch (err) { alert('সার্ভার এরর!'); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setShowForgotPassword(false);
        setForgotStep(1);
        setResetToken('');
        setNewPassword('');
        setPassword('');
      } else { alert(data.message); }
    } catch (err) { alert('সার্ভার এরর!'); }
  };

  const handleLogout = () => {
    getSocket().disconnect(); 
    localStorage.removeItem('chatUser');
    setUser(null); setActiveRoom(null); setMessages([]);
    setEmail(''); setPassword(''); setUsername(''); setIsLogin(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) setEditAvatar(data.imageUrl);
      else alert(data.message);
    } catch (err) { alert('ছবি আপলোড করা যাচ্ছে না!'); }
  };

  const handleUpdateProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/${user._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: editUsername, avatar: editAvatar }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setUser(data.user);
        localStorage.setItem('chatUser', JSON.stringify(data.user));
        setShowEditProfile(false);
        const usersRes = await fetch(`${API_URL}/api/users/${user._id}`);
        setUsersList(await usersRes.json());
      } else { alert(data.message); }
    } catch (err) { alert('প্রোফাইল আপডেট করা যায়নি!'); }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return alert('গ্রুপের নাম দাও!');
    try {
      const res = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomName, userId: user._id, memberIds: selectedMembers }),
      });
      
      if (res.ok) {
        setNewRoomName(''); setSelectedMembers([]); setIsCreatingGroup(false);
        const roomsRes = await fetch(`${API_URL}/api/rooms/${user._id}`);
        setRooms(await roomsRes.json());
      } else { alert((await res.json()).message); }
    } catch (err) { alert('রুম তৈরি করা যায়নি!'); }
  };

  const startPrivateChat = async (targetUserId) => {
    try {
      const res = await fetch(`${API_URL}/api/rooms/private`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user1Id: user._id, user2Id: targetUserId }),
      });
      const roomData = await res.json();
      if (!res.ok) return alert(roomData.message);

      setRooms((prev) => prev.find(r => r._id === roomData._id) ? prev : [roomData, ...prev]);
      selectRoom(roomData);
    } catch (err) { alert('প্রাইভেট চ্যাটে সমস্যা!'); }
  };

  const selectRoom = (room) => {
    setActiveRoom(room); setMessages([]); setShowManageGroup(false); setShowEmojiPicker(false);
    getSocket().emit('join_room', room._id);
  };

  const handleAddMember = async (memberId) => {
    try {
      const res = await fetch(`${API_URL}/api/rooms/${activeRoom._id}/members`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id, newMemberId: memberId }),
      });
      const data = await res.json();
      if (res.ok) { setActiveRoom(data.room); updateRoomsList(data.room); }
      else alert(data.message);
    } catch (err) { console.error(err); }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('এই মেম্বারকে রিমুভ করতে চাও?')) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${activeRoom._id}/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id }),
      });
      const data = await res.json();
      if (res.ok) { setActiveRoom(data.room); updateRoomsList(data.room); }
      else alert(data.message);
    } catch (err) { console.error(err); }
  };

  const handleMakeAdmin = async (memberId) => {
    try {
      const res = await fetch(`${API_URL}/api/rooms/${activeRoom._id}/admins`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id, newAdminId: memberId }),
      });
      const data = await res.json();
      if (res.ok) { setActiveRoom(data.room); updateRoomsList(data.room); alert('নতুন অ্যাডমিন তৈরি হয়েছে'); }
      else alert(data.message);
    } catch (err) { console.error(err); }
  };

  const updateRoomsList = (updatedRoom) => {
    setRooms(rooms.map(r => r._id === updatedRoom._id ? updatedRoom : r));
  };

  const handleDeleteGroup = async (roomId) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই গ্রুপটি ডিলিট করতে চান?')) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id }),
      });
      if (res.ok) {
        setRooms(rooms.filter(r => r._id !== roomId));
        setActiveRoom(null);
      } else { alert((await res.json()).message); }
    } catch (err) { alert('গ্রুপ ডিলিট করা যায়নি!'); }
  };

  const sendMessage = (customText = null) => {
    const messageText = customText || text;
    if (!messageText.trim() || !activeRoom) return;
    
    getSocket().emit('send_message', { roomId: activeRoom._id, senderId: user._id, text: messageText });
    setText('');
    setShowEmojiPicker(false);
  };

  const handleSendChatImage = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeRoom) return;
    const formData = new FormData();
    formData.append('image', file);

    setIsUploading(true);
    try {
      const res = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        getSocket().emit('send_message', { roomId: activeRoom._id, senderId: user._id, text: '', imageUrl: data.imageUrl });
      } else { alert(data.message); }
    } catch (err) { alert('ছবি পাঠানো যাচ্ছে না!'); }
    setIsUploading(false);
    e.target.value = null; 
  };

  const handleSendChatVideo = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeRoom) return;
    const formData = new FormData();
    formData.append('video', file);

    setIsUploading(true);
    try {
      const res = await fetch(`${API_URL}/api/upload-video`, { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        getSocket().emit('send_message', { roomId: activeRoom._id, senderId: user._id, text: '', videoUrl: data.videoUrl });
      } else { alert(data.message); }
    } catch (err) { alert('ভিডিও পাঠানো যাচ্ছে না!'); }
    setIsUploading(false);
    e.target.value = null; 
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'voice-note.webm');

        setIsUploading(true);
        try {
          const res = await fetch(`${API_URL}/api/upload-audio`, { method: 'POST', body: formData });
          const data = await res.json();
          if (res.ok) {
            getSocket().emit('send_message', { roomId: activeRoom._id, senderId: user._id, text: '', audioUrl: data.audioUrl });
          } else { alert(data.message); }
        } catch (err) { alert('অডিও পাঠানো যাচ্ছে না!'); }
        setIsUploading(false);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert('মাইক্রোফোন অ্যাক্সেস দেওয়া হয়নি বা কোনো সমস্যা হয়েছে!');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const addEmojiToText = (emoji) => {
    setText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  // ================= UI =================

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', color: 'white' }}>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)', padding: '40px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px 0 rgba(0,0,0,0.37)', width: '350px' }}>
          
          {showForgotPassword ? (
            <>
              <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Reset Password</h2>
              {forgotStep === 1 ? (
                <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <p style={{ fontSize: '13px', color: '#aaa', textAlign: 'center' }}>আপনার অ্যাকাউন্টের ইমেইলটি দিন।</p>
                  <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }} required />
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit" style={{ padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(90deg, #6366f1, #a855f7)', color: 'white', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Send Reset Token</motion.button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <p style={{ fontSize: '13px', color: '#4caf50', textAlign: 'center' }}>টোকেনটি সার্ভারের টার্মিনালে প্রিন্ট হয়েছে।</p>
                  <input type="text" placeholder="Reset Token" value={resetToken} onChange={(e) => setResetToken(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }} required />
                  <input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }} required />
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit" style={{ padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(90deg, #6366f1, #a855f7)', color: 'white', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Reset Password</motion.button>
                </form>
              )}
              <p onClick={() => { setShowForgotPassword(false); setForgotStep(1); }} style={{ cursor: 'pointer', textAlign: 'center', color: '#a855f7', marginTop: '20px', fontSize: '14px' }}>Back to Login</p>
            </>
          ) : (
            <>
              <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
              <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {!isLogin && <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }} required />}
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }} required />
                
                <div style={{ position: 'relative', width: '100%' }}>
                  <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }} required />
                  <span onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: 12, cursor: 'pointer', opacity: 0.7 }}>{showPassword ? '🙈' : '👁️'}</span>
                </div>

                {isLogin && (
                  <p onClick={() => setShowForgotPassword(true)} style={{ cursor: 'pointer', textAlign: 'right', color: '#818cf8', fontSize: '12px', marginTop: '-5px', marginBottom: '5px' }}>Forgot Password?</p>
                )}

                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit" style={{ padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(90deg, #6366f1, #a855f7)', color: 'white', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>{isLogin ? 'Login' : 'Register'}</motion.button>
              </form>
              <p onClick={() => setIsLogin(!isLogin)} style={{ cursor: 'pointer', textAlign: 'center', color: '#a855f7', marginTop: '20px', fontSize: '14px' }}>
                {isLogin ? 'নতুন ইউজার? রেজিস্টার করো' : 'আগে থেকেই অ্যাকাউন্ট আছে? লগইন করো'}
              </p>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  const isAdmin = activeRoom && (String(activeRoom.createdBy) === String(user._id) || activeRoom.admins?.includes(user._id));

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', color: 'white', fontFamily: 'sans-serif' }}>
      
      {/* এডিট প্রোফাইল মোডাল */}
      <AnimatePresence>
        {showEditProfile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50 }}>
            <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 20 }} style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', padding: '30px', borderRadius: '20px', width: '350px', border: '1px solid rgba(255,255,255,0.2)' }}>
              <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Edit Profile</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#ccc' }}>Username</label>
                  <input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: 'rgba(0,0,0,0.3)', color: 'white', marginTop: '5px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#ccc' }}>Profile Picture</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                    <Image src={editAvatar || `https://ui-avatars.com/api/?name=${editUsername}&background=random&color=fff`} alt="preview" width={50} height={50} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ width: '100%', padding: '5px', background: 'rgba(0,0,0,0.3)', color: 'white', borderRadius: '8px', fontSize: '12px' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button onClick={handleUpdateProfile} style={{ flex: 1, padding: '10px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
                  <button onClick={() => setShowEditProfile(false)} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* সাইডবার */}
      <div style={{ width: '320px', background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(10px)', borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
        
        {/* হেডার */}
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src={user.avatar || `https://ui-avatars.com/api/?name=${user.username}&background=random&color=fff`} alt="avatar" width={45} height={45} style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid #6366f1' }} />
            <div>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>{user.username}</h3>
              <p style={{ margin: 0, fontSize: '12px', color: connected ? '#4caf50' : '#f44336' }}>{connected ? '● Online' : '● Offline'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <motion.button whileHover={{ scale: 1.1 }} onClick={() => { setEditUsername(user.username); setEditAvatar(user.avatar || ''); setShowEditProfile(true); }} style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              <Edit size={16} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.1 }} onClick={handleLogout} style={{ padding: '8px', background: 'rgba(244, 67, 54, 0.2)', color: '#f44336', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              <LogOut size={16} />
            </motion.button>
          </div>
        </div>

        {/* গ্রুপ তৈরি */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={() => setIsCreatingGroup(!isCreatingGroup)} style={{ width: '100%', padding: '15px', background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            {isCreatingGroup ? <X size={18} /> : <Plus size={18} />} {isCreatingGroup ? 'Cancel' : 'Create New Group'}
          </button>
          <AnimatePresence>
            {isCreatingGroup && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ padding: '15px', background: 'rgba(0,0,0,0.2)', overflow: 'hidden' }}>
                <input placeholder="Group Name" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
                <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>Select Members:</p>
                <div style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '10px' }}>
                  {usersList.map(u => (
                    <label key={u._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '14px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={selectedMembers.includes(u._id)} onChange={(e) => {
                        if (e.target.checked) setSelectedMembers([...selectedMembers, u._id]);
                        else setSelectedMembers(selectedMembers.filter(id => id !== u._id));
                      }} />
                      {u.username}
                    </label>
                  ))}
                </div>
                <button onClick={handleCreateRoom} style={{ width: '100%', padding: '10px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Create Group</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ইউজার ও গ্রুপ লিস্ট */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          <div style={{ padding: '10px 20px', fontSize: '11px', color: '#6366f1', fontWeight: 'bold', letterSpacing: '1px' }}>DIRECT MESSAGES</div>
          {usersList.map((u) => {
            const isOnline = onlineUsers.includes(u._id);
            return (
              <motion.div whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }} key={u._id} onClick={() => startPrivateChat(u._id)} style={{ padding: '15px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ position: 'relative' }}>
                  <Image src={u.avatar || `https://ui-avatars.com/api/?name=${u.username}&background=random&color=fff`} alt="avatar" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                  {isOnline && <div style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, backgroundColor: '#4caf50', borderRadius: '50%', border: '2px solid #1e1b4b' }} />}
                </div>
                <span style={{ fontWeight: '500' }}>{u.username}</span>
              </motion.div>
            );
          })}

          <div style={{ padding: '20px 20px 10px 20px', fontSize: '11px', color: '#6366f1', fontWeight: 'bold', letterSpacing: '1px' }}>GROUPS</div>
          {rooms.filter((room) => room.name !== 'Private Chat' && room.name && room.name.trim() !== '').map((room) => (
            <motion.div whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }} key={room._id} onClick={() => selectRoom(room)} style={{ padding: '15px 20px', cursor: 'pointer', backgroundColor: activeRoom?._id === room._id ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0)', borderLeft: activeRoom?._id === room._id ? '3px solid #6366f1' : '3px solid transparent', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Image src={`https://ui-avatars.com/api/?name=${room.name}&background=random&color=fff`} alt="group avatar" width={40} height={40} style={{ borderRadius: '50%' }} />
              <span style={{ fontWeight: '500' }}>{room.name}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* চ্যাট এরিয়া */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {!activeRoom ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
            <h2>কথা বলার জন্য কাউকে বা কোনো রুমকে সিলেক্ট করো</h2>
          </div>
        ) : (
          <>
            {/* চ্যাট হেডার */}
            <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                {(() => {
                  if (activeRoom.name === 'Private Chat') {
                    const otherUserId = activeRoom.members.find(id => String(id) !== String(user._id));
                    const otherUser = usersList.find(u => String(u._id) === String(otherUserId));
                    const isOtherUserOnline = onlineUsers.includes(otherUserId);
                    if (otherUser) {
                      return (
                        <>
                          <Image src={otherUser.avatar || `https://ui-avatars.com/api/?name=${otherUser.username}&background=random&color=fff`} alt="avatar" width={45} height={45} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                          <div>
                            <h2 style={{ margin: 0, fontSize: 18 }}>{otherUser.username}</h2>
                            <p style={{ margin: 0, fontSize: 12, color: isOtherUserOnline ? '#4caf50' : '#888' }}>{isOtherUserOnline ? '● Online' : '● Offline'}</p>
                          </div>
                        </>
                      );
                    }
                  }
                  return (
                    <>
                      <Image src={`https://ui-avatars.com/api/?name=${activeRoom.name}&background=random&color=fff`} alt="group" width={45} height={45} style={{ borderRadius: '50%' }} />
                      <h2 style={{ margin: 0, fontSize: 18 }}>{activeRoom.name}</h2>
                    </>
                  );
                })()}
              </div>

              {isAdmin && activeRoom.name !== 'Private Chat' && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <motion.button whileHover={{ scale: 1.05 }} onClick={() => setShowManageGroup(!showManageGroup)} style={{ padding: '8px 15px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>Manage Group</motion.button>
                  {String(activeRoom.createdBy) === String(user._id) && (
                    <motion.button whileHover={{ scale: 1.05 }} onClick={() => handleDeleteGroup(activeRoom._id)} style={{ padding: '8px 15px', background: 'rgba(244, 67, 54, 0.2)', color: '#f44336', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>Delete</motion.button>
                  )}
                </div>
              )}
            </div>

            {/* ম্যানেজ গ্রুপ মোডাল */}
            <AnimatePresence>
              {showManageGroup && activeRoom.name !== 'Private Chat' && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} style={{ position: 'absolute', top: 80, right: 20, width: '350px', background: 'rgba(30, 27, 75, 0.95)', backdropFilter: 'blur(20px)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)', zIndex: 10, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0 }}>Group Members</h3>
                    <button onClick={() => setShowManageGroup(false)} style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer' }}><X size={20} /></button>
                  </div>
                  
                  {usersList.map(u => {
                    const isMember = activeRoom.members.includes(u._id);
                    const isRoomAdmin = activeRoom.admins?.includes(u._id);
                    const isCreator = String(activeRoom.createdBy) === String(u._id);
                    if (u._id === user._id) return null;

                    return (
                      <div key={u._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Image src={u.avatar || `https://ui-avatars.com/api/?name=${u.username}&background=random&color=fff`} alt="u" width={30} height={30} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                          <span style={{ fontSize: '14px' }}>{u.username} {isCreator ? '(Creator)' : isRoomAdmin ? '(Admin)' : ''}</span>
                        </div>
                        <div>
                          {!isMember ? (
                            <button onClick={() => handleAddMember(u._id)} style={{ padding: '6px 10px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>Add</button>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {!isRoomAdmin && !isCreator && (
                                <button onClick={() => handleMakeAdmin(u._id)} style={{ padding: '6px 10px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>Admin</button>
                              )}
                              {!isCreator && (
                                <button onClick={() => handleRemoveMember(u._id)} style={{ padding: '6px 10px', background: '#f44336', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>Remove</button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {/* মেসেজ এরিয়া */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {messages.length === 0 && <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', marginTop: '50px' }}>কোনো মেসেজ নেই। প্রথম মেসেজটা পাঠাও!</p>}
              
              <AnimatePresence>
                {messages.map((msg, index) => {
                  const isMe = String(msg.senderId) === String(user._id);
                  const isLike = msg.text === '👍'; 
                  
                  const sender = usersList.find(u => String(u._id) === String(msg.senderId));
                  const senderName = isMe ? user.username : (sender ? sender.username : 'User');
                  const senderAvatar = isMe ? user.avatar : (sender ? sender.avatar : null);
                  const finalAvatar = senderAvatar || `https://ui-avatars.com/api/?name=${senderName}&background=random&color=fff`;

                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 20, scale: 0.95 }} 
                      animate={{ opacity: 1, y: 0, scale: 1 }} 
                      key={msg._id || index} 
                      style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%', display: 'flex', gap: '12px', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end' }}
                    >
                      <Image src={finalAvatar} alt="avatar" width={35} height={35} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                      
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '5px', marginLeft: isMe ? 0 : '5px', marginRight: isMe ? '5px' : 0 }}>
                          {senderName}
                        </span>
                        <div style={{ 
                          background: isMe ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255,255,255,0.1)', 
                          padding: (isLike || msg.imageUrl || msg.audioUrl || msg.videoUrl) ? '0' : '12px 18px', 
                          borderRadius: isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px', 
                          color: 'white', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          overflow: 'hidden',
                          boxShadow: isMe ? '0 4px 15px rgba(99, 102, 241, 0.3)' : '0 4px 15px rgba(0,0,0,0.1)'
                        }}>
                          {msg.videoUrl ? (
                            <video controls src={msg.videoUrl} style={{ width: '250px', maxWidth: '100%', maxHeight: '300px', borderRadius: '10px' }} />
                          ) : msg.imageUrl ? (
                            <img src={msg.imageUrl} alt="sent image" style={{ width: 'auto', maxWidth: '250px', maxHeight: '300px', objectFit: 'contain' }} />
                          ) : msg.audioUrl ? (
                            <audio controls src={msg.audioUrl} style={{ width: '250px', height: '45px', margin: '5px' }} />
                          ) : isLike ? (
                            <span style={{ fontSize: '45px', padding: '10px', display: 'block' }}>👍</span>
                          ) : (
                            msg.text
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* ইনপুট বক্স */}
            <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '12px', position: 'relative', alignItems: 'center' }}>
              
              {isUploading && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ position: 'absolute', top: -30, left: 20, color: '#a855f7', fontSize: '13px', fontWeight: 'bold' }}>
                  Uploading... ⏳
                </motion.div>
              )}

              <input type="file" accept="image/*" ref={chatFileInputRef} onChange={handleSendChatImage} style={{ display: 'none' }} />
              <motion.button whileHover={{ scale: 1.1 }} onClick={() => chatFileInputRef.current.click()} style={{ padding: '10px', background: 'transparent', border: 'none', color: '#818cf8', cursor: 'pointer' }} title="Send Image">
                <ImageIcon size={22} />
              </motion.button>

              <input type="file" accept="video/*" ref={chatVideoInputRef} onChange={handleSendChatVideo} style={{ display: 'none' }} />
              <motion.button whileHover={{ scale: 1.1 }} onClick={() => chatVideoInputRef.current.click()} style={{ padding: '10px', background: 'transparent', border: 'none', color: '#818cf8', cursor: 'pointer' }} title="Send Video">
                <Video size={22} />
              </motion.button>

              <motion.button whileHover={{ scale: 1.1 }} onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ padding: '10px', background: 'transparent', border: 'none', color: '#818cf8', cursor: 'pointer' }}>
                <Smile size={22} />
              </motion.button>

              <motion.button whileHover={{ scale: 1.1 }} onClick={isRecording ? stopRecording : startRecording} style={{ padding: '10px', background: 'transparent', border: 'none', color: isRecording ? '#f44336' : '#818cf8', cursor: 'pointer' }} title={isRecording ? "Stop Recording" : "Record Voice"}>
                {isRecording ? <Square size={22} /> : <Mic size={22} />}
              </motion.button>

              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} style={{ position: 'absolute', bottom: '80px', left: '20px', background: 'rgba(30, 27, 75, 0.95)', backdropFilter: 'blur(20px)', padding: '15px', borderRadius: '15px', display: 'flex', flexWrap: 'wrap', width: '220px', gap: '12px', zIndex: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {EMOJIS.map(emoji => (
                      <motion.span whileHover={{ scale: 1.3 }} key={emoji} onClick={() => addEmojiToText(emoji)} style={{ fontSize: '26px', cursor: 'pointer' }}>
                        {emoji}
                      </motion.span>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <input 
                placeholder="Type a message..." 
                value={text} 
                onChange={(e) => setText(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()} 
                style={{ flex: 1, padding: '14px 20px', borderRadius: '25px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none', fontSize: '15px' }} 
              />
              
              {text.trim() ? (
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => sendMessage()} style={{ padding: '12px 20px', borderRadius: '25px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Send size={20} />
                </motion.button>
              ) : (
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => sendMessage('👍')} style={{ padding: '12px', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#818cf8' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                  </svg>
                </motion.button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}