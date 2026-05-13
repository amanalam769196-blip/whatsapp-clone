const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://amanalam:aman8070@cluster0.an4ayhj.mongodb.net/whatsapp?appName=Cluster0')
.then(() => console.log('MongoDB connected!'))
.catch(err => console.log(err));

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  name: String,
  otp: String,
  otpExpiry: Date
});

const messageSchema = new mongoose.Schema({
  from: String,
  to: String,
  text: String,
  time: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

const SECRET = 'whatsapp-secret-key';
app.use(express.json());
app.use(express.static('public'));

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'amanalam769196@gmail.com',
    pass: process.env.GMAIL_PASS || 'advmlwrocdtmxbhp'
  }
});

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
    await transporter.sendMail({
      from: process.env.GMAIL_USER || 'amanalam769196@gmail.com',
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP is: ${otp} (valid for 10 minutes)`
    });
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
      r
cd ~/whatsapp-clone
cat > server.js << 'EOF'
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://amanalam:aman8070@cluster0.an4ayhj.mongodb.net/whatsapp?appName=Cluster0')
.then(() => console.log('MongoDB connected!'))
.catch(err => console.log(err));

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  name: String,
  otp: String,
  otpExpiry: Date
});

const messageSchema = new mongoose.Schema({
  from: String,
  to: String,
  text: String,
  time: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

const SECRET = 'whatsapp-secret-key';
app.use(express.json());
app.use(express.static('public'));

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'amanalam769196@gmail.com',
    pass: process.env.GMAIL_PASS || 'advmlwrocdtmxbhp'
  }
});

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
    await transporter.sendMail({
      from: process.env.GMAIL_USER || 'amanalam769196@gmail.com',
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP is: ${otp} (valid for 10 minutes)`
    });
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
  const users = await User.find({}, 'email name');
  res.json(users);
});

io.on('connection', (socket) => {
  socket.on('private-message', async (data) => {
    const msg = new Message(data);
    await msg.save();
    io.emit('private-message', data);
  });
});

http.listen(process.env.PORT || 3000, () => console.log('Server chal raha hai!'));
