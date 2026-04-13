// backend/models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Support both field names for compatibility
    content: { type: String, trim: true },
    message: { type: String, trim: true },

    // Read tracking
    read: { type: Boolean, default: false },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Soft delete - users who deleted this conversation
    deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Sender role for frontend differentiation
    senderRole: {
      type: String,
      enum: ['recruiter', 'jobseeker', 'admin'],
      default: 'jobseeker',
    },

    // Job context (set when recruiter reaches out about a job)
    relatedJob: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
    },
    jobTitle: { type: String },
    companyName: { type: String },
    recruiterName: { type: String },

    // Optional: scheduled messages
    scheduledAt: { type: Date },
  },
  { timestamps: true }
);

// Index for fast conversation queries
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, read: 1 });

// Virtual: get text regardless of field name
messageSchema.virtual('text').get(function () {
  return this.content || this.message || '';
});

module.exports = mongoose.model('Message', messageSchema);
