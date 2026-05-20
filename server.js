require("dotenv").config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose');
const { Resend } = require('resend');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const webpush = require('web-push');

const resend = new Resend(process.env.RESEND_KEY);

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:amanalam769196@gmail.com',
  process.env.VAPID_PUBLIC || 'BC7QWLb-X8LRs-ez1dt6bv_N2bkQ4MoH4wxeteBoADrZYr1Sp_RL1bypdFUra1QzYWb9Jav2SwUYHEC4f7jUIlY',
  process.env.VAPID_PRIVATE || 'KvMfeJaEwU2o2Z7GGZE3ZX4Uekny-kXgPIa0Ql8d7nk'
);

mongoose.connect(process.env.MONGO_URL)
.then(() => console.log('MongoDB connected!'))
.catch(err => console.log(err));

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  name: String,
  otp: String,
  otpExpiry: Date,
  online: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  profilePhoto: { type: String, default: '' },
  pushSubscription: Object
});

const messageSchema = new mongoose.Schema({
  replyTo: { text: String, from: String },
  from: String,
  to: String,
  groupId: String,
  text: String,
  image: String,
  audio: String,
  time: { type: Date, default: Date.now },
  delivered: { type: Boolean, default: false },
  read: { type: Boolean, default: false }
});

const groupSchema = new mongoose.Schema({
  name: String,
  members: [String],
  admin: String,
  time: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const statusSchema = new mongoose.Schema({
  email: String,
  name: String,
  text: String,
  image: String,
  time: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24*60*60*1000) }
});
const Status = mongoose.model("Status", statusSchema);
const Group = mongoose.model('Group', groupSchema);

const SECRET = 'whatsapp-secret-key';
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.post('/send-otp', async (req, res) => {
  try {
    const { email, name } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    let user = await User.findOne({ email });
    if (!user) user = new User({ email, name });
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();
    const { error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Your OTP Code - ChatApp',
      html: `<h2>Your OTP Code</h2><p>Your OTP is: <b>${otp}</b></p><p>Valid for 10 minutes.</p>`
    });
    if (error) return res.json({ error: error.message });
    res.json({ success: true });
  } catch(err) {
    res.json({ error: err.message });
  }
});

app.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.otp !== otp || new Date() > user.otpExpiry) {
      return res.json({ error: 'OTP galat ya expire ho gaya!' });
    }
    user.otp = null;
    await user.save();
    const token = jwt.sign({ email, name: user.name }, SECRET);
    res.json({ token, email, name: user.name });
  } catch(err) {
    res.json({ error: err.message });
  }
});

app.post('/save-subscription', async (req, res) => {
  try {
    const { email, subscription } = req.body;
    await User.findOneAndUpdate({ email }, { pushSubscription: subscription });
    res.json({ success: true });
  } catch(err) {
    res.json({ error: err.message });
  }
});

app.get('/vapid-public', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC || 'BC7QWLb-X8LRs-ez1dt6bv_N2bkQ4MoH4wxeteBoADrZYr1Sp_RL1bypdFUra1QzYWb9Jav2SwUYHEC4f7jUIlY' });
});

app.get('/users', async (req, res) => {
  const users = await User.find({}, 'email name online profilePhoto lastSeen');
  res.json(users);
});

app.get('/messages/:from/:to', async (req, res) => {
  const { from, to } = req.params;
  const messages = await Message.find({
    $or: [{ from, to }, { from: to, to: from }]
  }).sort({ time: 1 });
  res.json(messages);
});

app.post('/create-group', async (req, res) => {
  try {
    const { name, members, admin } = req.body;
    const group = new Group({ name, members, admin });
    await group.save();
    res.json({ success: true, group });
  } catch(err) {
    res.json({ error: err.message });
  }
});

app.get('/groups/:email', async (req, res) => {
  const groups = await Group.find({ members: req.params.email });
  res.json(groups);
});

app.get('/group-messages/:groupId', async (req, res) => {
  const messages = await Message.find({ groupId: req.params.groupId }).sort({ time: 1 });
  res.json(messages);
});

app.post('/upload-profile', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.json({ error: 'Photo nahi mili!' });
    const photoUrl = '/uploads/' + req.file.filename;
    await User.findOneAndUpdate({ email: req.body.email }, { profilePhoto: photoUrl });
    res.json({ success: true, photoUrl });
  } catch(err) {
    res.json({ error: err.message });
  }
});

app.delete("/message/:id", async (req, res) => {
  try {
    await Message.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch(err) { res.json({ error: err.message }); }
});

app.post("/add-status", async (req, res) => {
  try {
    const { email, name, text } = req.body;
    const status = new Status({ email, name, text });
    await status.save();
    res.json({ success: true });
  } catch(err) { res.json({ error: err.message }); }
});

app.get("/statuses", async (req, res) => {
  const statuses = await Status.find({ expiresAt: { $gt: new Date() } }).sort({ time: -1 });
  res.json(statuses);
});

app.post("/upload-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.json({ error: 'Image nahi mili!' });
    res.json({ success: true, imageUrl: '/uploads/' + req.file.filename });
  } catch(err) {
    res.json({ error: err.message });
  }
});

app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.json({ error: 'Audio nahi mili!' });
    res.json({ success: true, audioUrl: '/uploads/' + req.file.filename });
  } catch(err) {
    res.json({ error: err.message });
  }
});

io.on('connection', (socket) => {
  socket.on('join', async (email) => {
    socket.email = email;
    socket.join(email);
    await User.findOneAndUpdate({ email }, { online: true });
    io.emit('user-status', { email, online: true });
  });

  socket.on('private-message', async (data) => {
    const msg = new Message({ ...data, delivered: true });
    await msg.save();
    io.to(data.to).emit("private-message", { ...data, _id: msg._id, delivered: true, read: false });
    io.to(data.from).emit("private-message", { ...data, _id: msg._id, delivered: true, read: false });
    io.to(data.from).emit('private-message', { ...data, delivered: true, read: false });
    try {
      const toUser = await User.findOne({ email: data.to });
      if (toUser && toUser.pushSubscription && !toUser.online) {
        await webpush.sendNotification(toUser.pushSubscription, JSON.stringify({
          title: data.fromName,
          body: data.text || 'New message'
        }));
      }
    } catch(e) { console.log('Push error:', e.message); }
  });

  socket.on('group-message', async (data) => {
    const msg = new Message({ ...data, delivered: true });
    await msg.save();
    const group = await Group.findById(data.groupId);
    if (group) {
      group.members.forEach(member => {
        io.to(member).emit('group-message', data);
      });
    }
  });

  socket.on('join-group', (groupId) => { socket.join('group:' + groupId); });
  socket.on('call-offer', (data) => { io.to(data.to).emit('call-offer', data); });
  socket.on('call-answer', (data) => { io.to(data.to).emit('call-answer', data); });
  socket.on('ice-candidate', (data) => { io.to(data.to).emit('ice-candidate', data); });
  socket.on('call-end', (data) => { io.to(data.to).emit('call-end', data); });
  socket.on('call-reject', (data) => { io.to(data.to).emit('call-reject', data); });

  socket.on('disconnect', async () => {
    if (socket.email) {
      await User.findOneAndUpdate({ email: socket.email }, { online: false, lastSeen: new Date() });
      io.emit('user-status', { email: socket.email, online: false });
    }
  });
});

http.listen(process.env.PORT || 3000, () => console.log('Server chal raha hai!'));
