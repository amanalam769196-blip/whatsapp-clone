require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URL);

const User = mongoose.model('User', { username: String, password: String });
const Message = mongoose.model('Message', { 
  from: String, to: String, text: String, time: Date 
});

const SECRET = 'mera-secret-key';
const onlineUsers = {};

app.use(express.json());
app.use(express.static('public'));

app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  const exists = await User.findOne({ username });
  if (exists) return res.json({ error: 'User already exists' });
  const hash = await bcrypt.hash(password, 10);
  await User.create({ username, password: hash });
  res.json({ success: true });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.json({ error: 'User not found' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.json({ error: 'Wrong password' });
  const token = jwt.sign({ username }, SECRET);
  res.json({ token, username });
});

app.get('/messages/:user1/:user2', async (req, res) => {
  const { user1, user2 } = req.params;
  const msgs = await Message.find({
    $or: [
      { from: user1, to: user2 },
      { from: user2, to: user1 }
    ]
  }).sort({ time: 1 });
  res.json(msgs);
});

io.on('connection', (socket) => {
  socket.on('join', (username) => {
    onlineUsers[username] = socket.id;
    socket.username = username;
    io.emit('onlineUsers', Object.keys(onlineUsers));
  });

  socket.on('privateMessage', async (data) => {
    await Message.create({ 
      from: data.from, to: data.to, text: data.text, time: new Date() 
    });
    const toSocket = onlineUsers[data.to];
    if (toSocket) io.to(toSocket).emit('privateMessage', data);
    socket.emit('privateMessage', data);
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      delete onlineUsers[socket.username];
      io.emit('onlineUsers', Object.keys(onlineUsers));
    }
  });
});

http.listen(process.env.PORT || 3000, () => console.log('Server running on port 3000'));
