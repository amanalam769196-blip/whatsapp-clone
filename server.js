const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const db = low(new FileSync('db.json'));
db.defaults({ users: [], messages: [] }).write();

const SECRET = 'mera-secret-key';
app.use(express.json());
app.use(express.static('public'));

// Signup
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  const exists = db.get('users').find({ username }).value();
  if (exists) return res.json({ error: 'User pehle se hai!' });
  const hash = await bcrypt.hash(password, 10);
  db.get('users').push({ username, password: hash }).write();
  res.json({ success: true });
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.get('users').find({ username }).value();
  if (!user) return res.json({ error: 'User nahi mila!' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.json({ error: 'Password galat hai!' });
  const token = jwt.sign({ username }, SECRET);
  res.json({ token, username });
});

io.on('connection', (socket) => {
  socket.on('message', (data) => {
    db.get('messages').push(data).write();
    io.emit('message', data);
  });
});

http.listen(3000, () => console.log('Server chal raha hai!'));
