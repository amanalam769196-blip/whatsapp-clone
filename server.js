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
const Message = mongoose.model('Message', { username: String, text: String, time: Date });
const SECRET = 'mera-secret-key';
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
res.json({ token });
});
io.on('connection', (socket) => {
socket.on('message', async (data) => {
await Message.create({ username: data.username, text: data.text, time: new Date() });
io.emit('message', data);
});
});
http.listen(3000, () => console.log('Server running on port 3000'));
