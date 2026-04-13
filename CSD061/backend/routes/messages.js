const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const auth     = require('../middleware/auth');
let AppMessage;
try { AppMessage = mongoose.model('Message'); } catch(_) {
  const s = new mongoose.Schema({
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: false },
    sender:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiver:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderRole:    { type: String, default: 'recruiter' },
    content:       { type: String, trim: true },
    message:       { type: String, trim: true },
    text:          { type: String, trim: true },
    read:          { type: Boolean, default: false },
    readBy:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deletedBy:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    relatedJob:    { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    jobTitle:      { type: String },
    companyName:   { type: String },
    recruiterName: { type: String },
    scheduledAt:   { type: Date, default: null },
  }, { timestamps: true });
  s.index({ applicationId: 1, createdAt: 1 });
  s.index({ sender: 1, receiver: 1, createdAt: -1 });
  s.index({ receiver: 1, read: 1 });
  AppMessage = mongoose.model('Message', s);
}

/* ── helpers ── */
function getSenderRole(user) {
  const t = user?.userType || user?.role || user?.accountType || user?.type || '';
  if (t.toLowerCase().includes('recruit')) return 'recruiter';
  return 'jobSeeker';
}

function getTextFromMsg(m) {
  return m.text || m.content || m.message || '';
}

router.get('/conversations', auth, async (req, res) => {
  try {
    const myId = req.user._id;

    // Find all messages where I am sender or receiver, not deleted by me
    const msgs = await AppMessage.find({
      $or: [
        { sender: myId },
        { receiver: myId },
        { senderId: myId },
      ],
      deletedBy: { $ne: myId },
    })
    .sort({ createdAt: -1 })
    .populate('sender',   'username name email recruiterProfile currentCompany')
    .populate('receiver', 'username name email recruiterProfile currentCompany')
    .populate('senderId', 'username name email recruiterProfile currentCompany')
    .populate('relatedJob', 'title company')
    .lean();

    // Group by the OTHER user
    const map = {};
    for (const m of msgs) {
      const sId = String(m.sender?._id || m.senderId?._id || '');
      const rId = String(m.receiver?._id || '');
      const myStr = String(myId);

      const isMe = sId === myStr;
      const otherId = isMe ? rId : sId;
      const otherUser = isMe ? m.receiver : (m.sender || m.senderId);

      if (!otherId || otherId === 'undefined') continue;

      const companyName =
        otherUser?.recruiterProfile?.companyName ||
        otherUser?.currentCompany ||
        m.companyName || '';

      const recruiterName =
        otherUser?.username || otherUser?.name || m.recruiterName || 'Recruiter';

      if (!map[otherId]) {
        map[otherId] = {
          _id: otherId,
          otherUser: {
            _id: otherId,
            name: recruiterName,
            company: companyName,
          },
          recruiterName,
          companyName,
          jobTitle: m.jobTitle || m.relatedJob?.title || '',
          lastMessage: getTextFromMsg(m),
          lastTime: m.createdAt,
          unreadCount: 0,
          rawMsgs: [],
        };
      }

      // Update last message (msgs are sorted desc so first = latest)
      if (!map[otherId].lastUpdated || new Date(m.createdAt) > new Date(map[otherId].lastUpdated)) {
        map[otherId].lastMessage = getTextFromMsg(m);
        map[otherId].lastTime = m.createdAt;
        map[otherId].lastUpdated = m.createdAt;
        if (!map[otherId].companyName && companyName) map[otherId].companyName = companyName;
        if (map[otherId].recruiterName === 'Recruiter' && recruiterName !== 'Recruiter') {
          map[otherId].recruiterName = recruiterName;
        }
      }

      // Count unread (messages TO me that I haven't read)
      const toMe = rId === myStr;
      const isRead = m.read || (Array.isArray(m.readBy) && m.readBy.map(String).includes(myStr));
      if (toMe && !isRead) map[otherId].unreadCount++;
    }

    const convs = Object.values(map).sort((a, b) =>
      new Date(b.lastTime) - new Date(a.lastTime)
    );

    res.json(convs);
  } catch (err) {
    console.error('GET /messages/conversations error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/thread/:otherId', auth, async (req, res) => {
  try {
    const myId    = req.user._id;
    const otherId = req.params.otherId;

    if (!mongoose.Types.ObjectId.isValid(otherId))
      return res.status(400).json({ message: 'Invalid otherId' });

    const msgs = await AppMessage.find({
      $or: [
        { sender: myId,   receiver: otherId },
        { sender: otherId, receiver: myId },
        { senderId: myId,  receiver: otherId },
        { senderId: otherId, receiver: myId },
      ],
      deletedBy: { $ne: myId },
    })
    .sort({ createdAt: 1 })
    .populate('sender',   'username name email recruiterProfile currentCompany')
    .populate('receiver', 'username name email recruiterProfile currentCompany')
    .populate('senderId', 'username name email recruiterProfile currentCompany')
    .populate('relatedJob', 'title company')
    .lean();

    const myStr = String(myId);
    const result = msgs.map(m => {
      const sUser = m.sender || m.senderId;
      const sId = String(sUser?._id || '');
      const isMe = sId === myStr;
      const company = sUser?.recruiterProfile?.companyName || sUser?.currentCompany || m.companyName || '';
      return {
        _id:         m._id,
        content:     getTextFromMsg(m),
        message:     getTextFromMsg(m),
        text:        getTextFromMsg(m),
        sender:      { _id: sUser?._id, name: sUser?.username || sUser?.name || '' },
        receiver:    { _id: m.receiver?._id },
        senderRole:  m.senderRole || (isMe ? 'jobseeker' : 'recruiter'),
        companyName: company,
        recruiterName: !isMe ? (sUser?.username || sUser?.name || 'Recruiter') : '',
        jobTitle:    m.jobTitle || m.relatedJob?.title || '',
        read:        m.read,
        readBy:      m.readBy,
        createdAt:   m.createdAt,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('GET /messages/thread/:otherId error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.patch('/thread/:otherId/read-all', auth, async (req, res) => {
  try {
    const myId    = req.user._id;
    const otherId = req.params.otherId;

    if (!mongoose.Types.ObjectId.isValid(otherId))
      return res.status(400).json({ message: 'Invalid otherId' });

    await AppMessage.updateMany(
      {
        $or: [
          { sender: otherId, receiver: myId },
          { senderId: otherId, receiver: myId },
        ],
        read: false,
      },
      {
        $set: { read: true },
        $addToSet: { readBy: myId },
      }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /messages/thread/read-all error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/scheduled/jobseeker', auth, async (req, res) => {
  try {
    const myId = req.user._id;
    const now  = new Date();

    const msgs = await AppMessage.find({
      $or: [{ receiver: myId }],
      scheduledAt: { $gt: now },
    })
    .sort({ scheduledAt: 1 })
    .populate('sender',   'username name email recruiterProfile currentCompany')
    .populate('senderId', 'username name email recruiterProfile currentCompany')
    .lean();

    const result = msgs.map(m => {
      const sUser = m.sender || m.senderId;
      const company = sUser?.recruiterProfile?.companyName || sUser?.currentCompany || m.companyName || '';
      return {
        _id:         m._id,
        text:        getTextFromMsg(m),
        senderName:  sUser?.username || sUser?.name || m.recruiterName || 'Recruiter',
        companyName: company,
        scheduledAt: m.scheduledAt,
        createdAt:   m.createdAt,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('GET /messages/scheduled/jobseeker error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.delete('/conversation/:otherId', auth, async (req, res) => {
  try {
    const myId    = req.user._id;
    const otherId = req.params.otherId;

    await AppMessage.updateMany(
      {
        $or: [
          { sender: myId,    receiver: otherId },
          { sender: otherId, receiver: myId   },
          { senderId: myId,  receiver: otherId },
        ],
      },
      { $addToSet: { deletedBy: myId } }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /messages/conversation error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/bulk', auth, async (req, res) => {
  try {
    const { applicationIds, text, scheduledAt } = req.body;

    if (!Array.isArray(applicationIds) || !applicationIds.length)
      return res.status(400).json({ message: 'applicationIds array is required' });
    if (!text?.trim())
      return res.status(400).json({ message: 'text is required' });

    const senderRole = getSenderRole(req.user);
    const sd = scheduledAt ? new Date(scheduledAt) : null;
    const validIds = applicationIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (!validIds.length)
      return res.status(400).json({ message: 'No valid applicationIds provided' });

    // Get recruiter company name
    const User = mongoose.model('User');
    const recruiter = await User.findById(req.user._id).lean();
    const companyName = recruiter?.recruiterProfile?.companyName || recruiter?.currentCompany || '';
    const recruiterName = recruiter?.username || recruiter?.name || '';

    // Lookup applicantId for each application so jobseeker can see bulk msgs
    const Application = mongoose.model('Application');
    const appDocs = await Application.find({ _id: { $in: validIds } })
      .populate('jobId', 'title').lean();
    const appMap = {};
    appDocs.forEach(a => { appMap[String(a._id)] = a; });

    const docs = validIds.map(applicationId => {
      const app = appMap[String(applicationId)];
      return {
        applicationId,
        senderId:    req.user._id,
        sender:      req.user._id,
        receiver:    app?.applicantId || null,
        senderRole,
        text:        text.trim(),
        content:     text.trim(),
        message:     text.trim(),
        companyName,
        recruiterName,
        jobTitle:    app?.jobId?.title || '',
        scheduledAt: sd,
      };
    });

    await AppMessage.insertMany(docs);
    res.json({ sent: docs.length, scheduledAt: sd });
  } catch (err) {
    console.error('POST /messages/bulk error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/:applicationId', auth, async (req, res) => {
  try {
    const { applicationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(applicationId))
      return res.status(400).json({ message: 'Invalid applicationId' });

    const User = mongoose.model('User');
    const myId = req.user._id;

    const msgs = await AppMessage.find({ applicationId })
      .sort({ createdAt: 1 })
      .populate('senderId', 'username name email userType role recruiterProfile currentCompany')
      .lean();

    // If no msgs by applicationId, try sender/receiver pattern
    if (msgs.length === 0) {
      const fallback = await AppMessage.find({
        $or: [
          { sender: myId,          receiver: applicationId },
          { sender: applicationId, receiver: myId },
          { senderId: myId,        receiver: applicationId },
        ],
      })
      .sort({ createdAt: 1 })
      .populate('sender',   'username name email recruiterProfile currentCompany')
      .populate('senderId', 'username name email recruiterProfile currentCompany')
      .lean();

      const myStr = String(myId);
      const fallbackResult = fallback.map(m => {
        const sUser = m.sender || m.senderId;
        const sId = String(sUser?._id || '');
        const company = sUser?.recruiterProfile?.companyName || sUser?.currentCompany || m.companyName || '';
        return {
          _id: m._id, text: getTextFromMsg(m),
          from: m.senderRole || (sId === myStr ? 'recruiter' : 'jobSeeker'),
          senderId: sUser?._id, senderName: sUser?.username || sUser?.name || '',
          companyName: company, senderRole: m.senderRole,
          createdAt: m.createdAt, scheduledAt: m.scheduledAt,
        };
      });
      return res.json(fallbackResult);
    }

    const result = msgs.map(m => {
      const sender = m.senderId || {};
      const companyName = sender.recruiterProfile?.companyName || sender.currentCompany || sender.recruiterProfile?.company || m.companyName || '';
      return {
        _id:         m._id,
        text:        getTextFromMsg(m),
        from:        m.senderRole,
        senderId:    sender._id,
        senderName:  sender.username || sender.name || sender.email || '',
        companyName,
        senderRole:  m.senderRole,
        createdAt:   m.createdAt,
        scheduledAt: m.scheduledAt,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('GET /messages/:applicationId error:', err);
    res.status(500).json({ message: err.message });
  }
});
router.post('/', auth, async (req, res) => {
  try {
    const { applicationId, receiverId, text, content, message, scheduledAt, isScheduleMsg } = req.body;
    const msgText = (text || content || message || '').trim();

    if (!msgText) return res.status(400).json({ message: 'text is required' });

    const User = mongoose.model('User');
    const senderUser = await User.findById(req.user._id).lean();
    const senderRole = getSenderRole(req.user);
    const companyName = senderUser?.recruiterProfile?.companyName || senderUser?.currentCompany || '';
    const recruiterName = senderUser?.username || senderUser?.name || '';

    let msg;

    if (applicationId && mongoose.Types.ObjectId.isValid(applicationId)) {
      let receiverUserId = null;
      let jobTitle = '';
      try {
        const Application = mongoose.model('Application');
        const app = await Application.findById(applicationId)
          .populate('jobId', 'title company')
          .lean();
        if (app) {
          receiverUserId = app.applicantId;
          jobTitle = app.jobId?.title || '';
        }
      } catch (_) {}

      msg = await AppMessage.create({
        applicationId,
        senderId:  req.user._id,
        sender:    req.user._id,
        receiver:  receiverUserId,
        senderRole,
        text:      msgText,
        content:   msgText,
        message:   msgText,
        companyName,
        recruiterName,
        jobTitle,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      });
      await msg.populate('senderId', 'username name email userType role recruiterProfile currentCompany');

      return res.status(201).json({
        message: {
          _id:         msg._id,
          text:        msgText,
          from:        msg.senderRole,
          senderId:    msg.senderId?._id || msg.senderId,
          senderName:  msg.senderId?.username || msg.senderId?.name || recruiterName,
          companyName,
          senderRole:  msg.senderRole,
          createdAt:   msg.createdAt,
          scheduledAt: msg.scheduledAt,
        },
      });
    }

    if (receiverId && mongoose.Types.ObjectId.isValid(receiverId)) {
      // JobSeeker / SchedulePage style — sender/receiver-based
      const receiver = await User.findById(receiverId).lean();
      msg = await AppMessage.create({
        sender:       req.user._id,
        senderId:     req.user._id,
        receiver:     receiverId,
        senderRole,
        content:      msgText,
        message:      msgText,
        text:         msgText,
        companyName,
        recruiterName,
        scheduledAt:  scheduledAt ? new Date(scheduledAt) : null,
      });

      return res.status(201).json({
        _id:         msg._id,
        content:     msgText,
        message:     msgText,
        text:        msgText,
        sender:      { _id: req.user._id, name: recruiterName },
        receiver:    { _id: receiverId, name: receiver?.username || receiver?.name || '' },
        senderRole,
        companyName,
        recruiterName,
        read:        false,
        createdAt:   msg.createdAt,
      });
    }

    return res.status(400).json({ message: 'applicationId or receiverId is required' });
  } catch (err) {
    console.error('POST /messages error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/read', auth, async (req, res) => {
  try {
    const msg = await AppMessage.findByIdAndUpdate(
      req.params.id,
      { $set: { read: true }, $addToSet: { readBy: req.user._id } },
      { new: true }
    );
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /messages/:id/read error:', err);
    res.status(500).json({ message: err.message });
  }
});
module.exports = router;