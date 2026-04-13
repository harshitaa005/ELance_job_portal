// backend/server.js
require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const connectDB = require('./config/db');

const app = express();
connectDB();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/jobs',         require('./routes/jobs'));
app.use('/api/skills',       require('./routes/skills'));
app.use('/api/career-paths', require('./routes/careerPaths'));
app.use('/api/gemini',       require('./routes/gemini'));
app.use('/api/resume',       require('./routes/resume'));
app.use('/api/analytics',    require('./routes/analytics'));
app.use('/api/email',        require('./routes/email'));
app.use('/api/chat',         require('./routes/chat'));
app.use('/api/messages',     require('./routes/messages'));
app.use('/api/interview',    require('./routes/interview'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║  🚀 ELance Server running on :${PORT}           ║
║  📁 Uploads served at /uploads                 ║
╚════════════════════════════════════════════════╝
  `);
});
