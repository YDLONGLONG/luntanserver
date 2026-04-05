require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const followRoutes = require('./routes/followRoutes');
const messageRoutes = require('./routes/messageRoutes');

const app = express();
const server = http.createServer(app);
const clientOrigin = (process.env.CLIENT_URL || 'http://localhost:8080').replace(/\/$/, '');

const io = new Server(server, {
  cors: {
    origin: clientOrigin,
    credentials: true
  }
});

app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (_, res) => res.json({ message: 'forum server running' }));
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/messages', messageRoutes);

const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.on('login', (userId) => {
    onlineUsers.set(String(userId), socket.id);
    socket.join('forum-group');
  });

  socket.on('private-message', (payload) => {
    const receiverSocketId = onlineUsers.get(String(payload.receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('private-message', payload);
      io.to(receiverSocketId).emit('private-unread', { senderId: payload.senderId });
    }
  });

  socket.on('group-message', (payload) => {
    io.to('forum-group').emit('group-message', payload);
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`server running on ${PORT}`);
});
