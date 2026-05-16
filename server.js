const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose');
const { Resend } = require('resend');
const jwt = require('jsonwebtoken');

const resend = new Resend(process.env.RESEND_KEY || 're_DvzfQTsY_MWv4SpUS5Jh9kWQHbreM6kMQ');

mongoose.connect(process.env.MONGO_URL || 'mongodb+srv://amanalam:aman8070@cluster0.an4ayhj.mongodb.net/whatsapp?appName=Cluster0')
.then(() => console.log('MongoDB connected!'))
.catch(err => console.log(err));

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  name: String,
  otp: String,
  otpExpiry: Date,
  online: { type: Boolean, default: false }
});

const messageSchema = new mongoose.Schema({
  from: String,
  to: String,
  text: String,
  time: { type: Date, default: Date.now },
  delivered: { type: Boolean, default: false },
  read: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

const SECRET = 'whatsapp-secret-key';
app.use(express.json());
app.use(express.static('public'));

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
    console.log('OTP sent to:', email);
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

app.get('/users', async (req, res) => {
  const users = await User.find({}, 'email name online');
  res.json(users);
});

app.get('/messages/:from/:to', async (req, res) => {
  const { from, to } = req.params;
  const messages = await Message.find({
    $or: [{ from, to }, { from: to, to: from }]
  }).sort({ time: 1 });
  res.json(messages);
});

app.post('/read-messages', async (req, res) => {
  const { from, to } = req.body;
  await Message.updateMany({ from, to, read: false }, { read: true });
  res.json({ success: true });
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
    io.to(data.to).emit('private-message', { ...data, delivered: true, read: false });
    io.to(data.from).emit('private-message', { ...data, delivered: true, read: false });
  });

  socket.on('message-read', async (data) => {
    await Message.updateMany({ from: data.from, to: data.to, read: false }, { read: true });
    io.to(data.from).emit('message-read', data);
  });

  socket.on('disconnect', async () => {
    if (socket.email) {
      await User.findOneAndUpdate({ email: socket.email }, { online: false });
      io.emit('user-status', { email: socket.email, online: false });
    }
  });
});

http.listen(process.env.PORT || 3000, () => console.log('Server chal raha hai!'));
