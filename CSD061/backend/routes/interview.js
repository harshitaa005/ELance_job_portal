// backend/routes/interview.js
// AI Interview Engine — Groq (Llama 3.1 70B) with expert-level prompts
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const Application = require('../models/Application');
const Job         = require('../models/Job');
const User        = require('../models/User');
const mongoose    = require('mongoose');

/* ── Interview Report Schema ── */
let InterviewReport;
try { InterviewReport = mongoose.model('InterviewReport'); }
catch(_) {
  const s = new mongoose.Schema({
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
    jobId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    candidateId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recruiterId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    transcript:    [{ role: String, content: String, timestamp: Date, score: Number, feedback: String }],
    report: {
      overallScore:       { type: Number, default: 0 },
      communicationScore: { type: Number, default: 0 },
      technicalScore:     { type: Number, default: 0 },
      confidenceScore:    { type: Number, default: 0 },
      problemSolvingScore:{ type: Number, default: 0 },
      recommendation:     { type: String, enum: ['Strong Hire','Hire','Maybe','No Hire'], default: 'Maybe' },
      summary:            { type: String, default: '' },
      strengths:          [String],
      improvements:       [String],
      answerScores:       [{ question: String, answer: String, score: Number, feedback: String, keyPoints: [String] }],
      hiringJustification:{ type: String, default: '' },
    },
    completedAt: { type: Date },
    status: { type: String, enum: ['in_progress','completed'], default: 'in_progress' },
  }, { timestamps: true });
  InterviewReport = mongoose.model('InterviewReport', s);
}

/* ── Groq API helper ── */
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_KEY = () => process.env.GROQ_API_KEY;
// Use the most capable available model
const MODEL = () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

async function groq(messages, json = false, maxTokens = 1500) {
  const body = {
    model: MODEL(),
    messages,
    max_tokens: maxTokens,
    temperature: 0.4, // Lower = more precise, consistent outputs
  };
  if (json) body.response_format = { type: 'json_object' };
  const r = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY()}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`Groq API error ${r.status}: ${errText.slice(0, 200)}`);
  }
  const d = await r.json();
  return d.choices[0].message.content;
}

/* ══════════════════════════════════════════════════════
   POST /api/interview/start
  ══════════════════════════════════════════════════════ */
router.post('/start', auth, async (req, res) => {
  try {
    const { applicationId } = req.body;
    if (!applicationId) return res.status(400).json({ message: 'applicationId is required' });

    const app = await Application.findById(applicationId)
      .populate('jobId')
      .populate('applicantId', 'username email skills careerGoals experience bio');
    if (!app) return res.status(404).json({ message: 'Application not found' });

    const job       = app.jobId || {};
    const candidate = app.applicantId || {};

    // Build rich context strings
    const jobTitle    = job.title    || 'Software Engineer';
    const company     = job.company  || 'the company';
    const expLevel    = job.experience || 'Mid-level';
    const jobType     = job.type || 'Full Time';
    const jobDesc     = job.description || '';
    const jobSkills   = (job.requiredSkills || []).map(s => typeof s === 'object' ? s.name : s).join(', ') || 'general technical skills';
    const candSkills  = (candidate.skills  || []).join(', ') || 'not specified';
    const candGoals   = candidate.careerGoals || '';
    const candExp     = candidate.experience  || '';
    const candBio     = candidate.bio || '';

    const qPrompt = `You are Alex, a senior technical interviewer at ${company} with 15+ years of experience hiring for ${jobTitle} roles.

ROLE DETAILS:
- Position: ${jobTitle} (${expLevel}, ${jobType})
- Company: ${company}
- Required Skills: ${jobSkills}
${jobDesc ? `- Job Description: ${jobDesc.slice(0, 300)}` : ''}

CANDIDATE PROFILE:
- Skills: ${candSkills}
${candExp  ? `- Experience: ${candExp}`  : ''}
${candGoals? `- Career Goals: ${candGoals}` : ''}
${candBio  ? `- Background: ${candBio}`  : ''}

TASK: Generate exactly 6 high-quality interview questions that:
1. Are SPECIFIC to ${jobTitle} — not generic
2. Progress from easier to harder
3. Test real competency, not just theoretical knowledge
4. Include follow-up depth that reveals true understanding

Question distribution:
- Q1: Ice-breaker / background (builds rapport, assesses communication)
- Q2: Core technical skill (most critical skill for ${jobTitle})
- Q3: Problem-solving / system design (practical scenario)
- Q4: Behavioral — past experience using STAR method (Situation, Task, Action, Result)
- Q5: Advanced technical or domain-specific challenge
- Q6: Culture fit / motivation / future goals

Respond ONLY with this exact JSON (no extra text):
{
  "intro": "A warm, professional 2-sentence welcome from Alex mentioning ${company} and ${jobTitle}",
  "questions": [
    {
      "id": 1,
      "question": "Full question text — specific and clear",
      "type": "background|technical|problem-solving|behavioral|advanced|motivation",
      "focus": "What competency this specifically tests",
      "idealAnswerHints": "2-3 key points a strong answer should include"
    }
  ]
}`;

    const raw = await groq([
      { role: 'system', content: 'You are an expert interviewer. Always respond with valid JSON only.' },
      { role: 'user',   content: qPrompt }
    ], true, 2000);

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { parsed = { intro: `Hello! I'm Alex, your interviewer for the ${jobTitle} role at ${company}. Let's get started.`, questions: [] }; }

    // Ensure 6 questions
    if (!parsed.questions || parsed.questions.length === 0) {
      parsed.questions = generateFallbackQuestions(jobTitle, jobSkills);
    }

    // Create or reset report
    await InterviewReport.findOneAndDelete({ applicationId, status: 'in_progress' });
    const report = await InterviewReport.create({
      applicationId,
      jobId:       job._id    || null,
      candidateId: candidate._id,
      recruiterId: job.postedBy || null,
      status: 'in_progress',
      transcript: [],
    });

    res.json({
      reportId:      report._id,
      intro:         parsed.intro || `Welcome! I'm Alex, your interviewer for ${jobTitle} at ${company}.`,
      questions:     parsed.questions,
      jobTitle,
      company,
      candidateName: candidate.username || 'Candidate',
    });
  } catch (err) {
    console.error('Interview start error:', err);
    res.status(500).json({ message: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   POST /api/interview/answer
══════════════════════════════════════════════════════ */
router.post('/answer', auth, async (req, res) => {
  try {
    const { reportId, question, answer, questionIndex, totalQuestions } = req.body;
    const report = await InterviewReport.findById(reportId).populate('jobId');
    if (!report) return res.status(404).json({ message: 'Interview session not found' });

    const job      = report.jobId || {};
    const jobTitle = job.title   || 'Software Engineer';
    const company  = job.company || 'the company';

    // Handle empty/very short answers
    if (!answer || answer.trim().length < 5) {
      const emptyResponse = {
        score: 1,
        feedback: "I didn't catch a clear response to that question.",
        sentiment: 'unclear',
        nextMessage: questionIndex < totalQuestions - 1
          ? "No worries, let's move on to the next question."
          : "Let me compile your results now.",
        followUp: '',
        keyPoints: [],
      };
      report.transcript.push(
        { role: 'interviewer', content: question,            timestamp: new Date() },
        { role: 'candidate',   content: answer || '[no answer]', timestamp: new Date(), score: 1, feedback: emptyResponse.feedback }
      );
      await report.save();
      return res.json(emptyResponse);
    }

    const scorePrompt = `You are Alex, a senior interviewer at ${company} evaluating a ${jobTitle} candidate.

QUESTION ASKED: "${question}"

CANDIDATE'S ANSWER: "${answer}"

SCORING RUBRIC (score 0–10):
- 9-10: Exceptional — specific examples, deep insight, exceeds expectations
- 7-8:  Strong — clear, relevant, demonstrates solid competency
- 5-6:  Adequate — basic understanding, lacks depth or specifics
- 3-4:  Weak — vague, off-topic, or missing key points
- 1-2:  Poor — irrelevant, incorrect, or almost no useful content
- 0:    No answer / completely blank

EVALUATION CRITERIA:
1. Relevance: Does the answer directly address the question?
2. Depth: Does it show real understanding vs surface-level knowledge?
3. Specificity: Does it include concrete examples, numbers, or experiences?
4. Clarity: Is it well-structured and easy to follow?
5. Technical accuracy: Is the content correct for a ${jobTitle} role?

Respond ONLY with this exact JSON:
{
  "score": <integer 0-10>,
  "feedback": "<2-3 sentences: what was good, what was missing, be specific and constructive>",
  "keyPoints": ["<key point the candidate made>", "<another key point>"],
  "missedPoints": "<1 sentence about what a stronger answer would include, or empty string if score >= 8>",
  "sentiment": "excellent|confident|clear|adequate|vague|nervous|weak",
  "followUp": "<only include a follow-up question if answer was vague/incomplete AND this is not the last question, otherwise empty string>"
}`;

    const scoreRaw = await groq([
      { role: 'system', content: 'You are a strict but fair interviewer. Score honestly. Return valid JSON only.' },
      { role: 'user',   content: scorePrompt }
    ], true, 800);

    let scored;
    try { scored = JSON.parse(scoreRaw); }
    catch { scored = { score: 5, feedback: 'Thank you for your response.', keyPoints: [], missedPoints: '', sentiment: 'clear', followUp: '' }; }

    // Clamp score
    scored.score = Math.max(0, Math.min(10, Math.round(scored.score)));

    // Build Alex's spoken response — natural, conversational
    const isLast = questionIndex >= totalQuestions - 1;
    let nextMessage;

    if (scored.score >= 8) {
      const praise = ['Excellent answer.', 'Great response.', 'That was very well articulated.', 'Impressive answer.'][Math.floor(Math.random()*4)];
      nextMessage = isLast
        ? `${praise} ${scored.feedback} That completes all your questions — let me compile your results.`
        : `${praise} ${scored.feedback}`;
    } else if (scored.score >= 5) {
      nextMessage = isLast
        ? `Thank you. ${scored.feedback}${scored.missedPoints ? ' ' + scored.missedPoints : ''} That was your final question.`
        : `Thank you. ${scored.feedback}`;
    } else {
      nextMessage = isLast
        ? `I see. ${scored.feedback} That completes the interview — let me analyze your overall performance now.`
        : `I see. ${scored.feedback}`;
    }

    // Add follow-up if answer was vague and not last question
    if (scored.followUp && scored.followUp.length > 10 && !isLast) {
      nextMessage += ` ${scored.followUp}`;
    }

    // Save to transcript
    report.transcript.push(
      { role: 'interviewer', content: question, timestamp: new Date() },
      { role: 'candidate',   content: answer,   timestamp: new Date(), score: scored.score, feedback: scored.feedback }
    );
    await report.save();

    res.json({
      score:      scored.score,
      feedback:   scored.feedback,
      keyPoints:  scored.keyPoints  || [],
      sentiment:  scored.sentiment  || 'clear',
      nextMessage,
      followUp:   scored.followUp   || '',
    });
  } catch (err) {
    console.error('Interview answer error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/complete', auth, async (req, res) => {
  try {
    const { reportId } = req.body;
    const report = await InterviewReport.findById(reportId)
      .populate('jobId')
      .populate('candidateId', 'username email skills experience');
    if (!report) return res.status(404).json({ message: 'Report not found' });

    const job       = report.jobId || {};
    const candidate = report.candidateId || {};
    const jobTitle  = job.title   || 'Software Engineer';
    const company   = job.company || 'the company';

    // Build full Q&A transcript for analysis
    const qaTranscript = [];
    const candTurns = report.transcript.filter(t => t.role === 'candidate');
    const intrTurns = report.transcript.filter(t => t.role === 'interviewer');

    intrTurns.forEach((q, i) => {
      const a = candTurns[i];
      if (q && a) {
        qaTranscript.push(`Q${i+1} [Score: ${a.score || 0}/10]: ${q.content}\nAnswer: ${a.content}`);
      }
    });

    const avgScore = candTurns.length
      ? (candTurns.reduce((s, t) => s + (t.score || 0), 0) / candTurns.length).toFixed(1)
      : '5.0';

    const reportPrompt = `You are a senior HR director at ${company} writing a formal hiring assessment report.

CANDIDATE: ${candidate.username || 'Candidate'}
POSITION: ${jobTitle}
CANDIDATE SKILLS: ${(candidate.skills || []).join(', ') || 'not listed'}

COMPLETE INTERVIEW TRANSCRIPT WITH SCORES:
${qaTranscript.join('\n\n')}

AVERAGE ANSWER SCORE: ${avgScore}/10

ANALYSIS INSTRUCTIONS:
- Be specific — reference actual things the candidate said
- Be honest — if answers were weak, say so clearly
- Be actionable — give concrete improvement suggestions
- Base recommendation strictly on the evidence from answers

SCORING GUIDE FOR overallScore:
- 85-100: Strong Hire — consistently excellent, hire immediately
- 70-84:  Hire — solid performance, recommend hiring
- 50-69:  Maybe — mixed performance, further evaluation needed
- 0-49:   No Hire — significant gaps, not ready for this role

Respond ONLY with this exact JSON:
{
  "overallScore": <0-100, derived from answer quality and consistency>,
  "communicationScore": <0-100, based on clarity and articulation>,
  "technicalScore": <0-100, based on technical accuracy of answers>,
  "confidenceScore": <0-100, based on assertiveness and certainty>,
  "problemSolvingScore": <0-100, based on analytical thinking shown>,
  "recommendation": "Strong Hire|Hire|Maybe|No Hire",
  "summary": "<4-5 sentences: overall impression, key strengths, notable weaknesses, cultural fit>",
  "hiringJustification": "<2-3 sentences explaining WHY this recommendation was made, referencing specific answers>",
  "strengths": [
    "<specific strength with example from interview>",
    "<specific strength with example>",
    "<specific strength with example>"
  ],
  "improvements": [
    "<specific gap with suggestion on how to improve>",
    "<specific gap with suggestion>"
  ],
  "answerScores": [
    {
      "question": "<question text>",
      "score": <0-10>,
      "feedback": "<specific 1-2 sentence feedback on this answer>",
      "keyPoints": ["<point candidate made>", "<another point>"]
    }
  ]
}`;

    const raw = await groq([
      { role: 'system', content: 'You are a precise HR analyst. Base your assessment strictly on the interview evidence. Return valid JSON only.' },
      { role: 'user',   content: reportPrompt }
    ], true, 2500);

    let finalReport;
    try { finalReport = JSON.parse(raw); }
    catch {
      const fallbackScore = Math.round(parseFloat(avgScore) * 10);
      finalReport = {
        overallScore: fallbackScore,
        communicationScore: fallbackScore,
        technicalScore: fallbackScore,
        confidenceScore: fallbackScore,
        problemSolvingScore: fallbackScore,
        recommendation: fallbackScore >= 70 ? 'Hire' : fallbackScore >= 50 ? 'Maybe' : 'No Hire',
        summary: `The candidate completed the interview for the ${jobTitle} role with an average answer score of ${avgScore}/10.`,
        hiringJustification: 'Assessment based on interview performance.',
        strengths: ['Completed the interview', 'Showed willingness to engage'],
        improvements: ['Provide more specific examples', 'Deepen technical knowledge'],
        answerScores: candTurns.map((t, i) => ({
          question: intrTurns[i]?.content || `Question ${i+1}`,
          score: t.score || 5,
          feedback: t.feedback || 'Response recorded.',
          keyPoints: [],
        })),
      };
    }

    // Clamp all scores to 0–100
    const clamp = (v, fallback = 50) => Math.max(0, Math.min(100, Math.round(v || fallback)));

    report.report = {
      overallScore:        clamp(finalReport.overallScore),
      communicationScore:  clamp(finalReport.communicationScore),
      technicalScore:      clamp(finalReport.technicalScore),
      confidenceScore:     clamp(finalReport.confidenceScore),
      problemSolvingScore: clamp(finalReport.problemSolvingScore),
      recommendation:      ['Strong Hire','Hire','Maybe','No Hire'].includes(finalReport.recommendation)
                             ? finalReport.recommendation : 'Maybe',
      summary:             finalReport.summary || '',
      hiringJustification: finalReport.hiringJustification || '',
      strengths:           (finalReport.strengths   || []).slice(0, 5),
      improvements:        (finalReport.improvements|| []).slice(0, 4),
      answerScores:        (finalReport.answerScores|| []).slice(0, 8),
    };
    report.status      = 'completed';
    report.completedAt = new Date();
    await report.save();

    // Auto-advance application status based on score
    const score = report.report.overallScore;
    const rec   = report.report.recommendation;
    if (rec === 'Strong Hire' || score >= 75) {
      await Application.findByIdAndUpdate(report.applicationId, { status: 'accepted' });
    } else if (rec === 'Hire' || score >= 60) {
      await Application.findByIdAndUpdate(report.applicationId, { status: 'shortlisted' });
    }
    // 'Maybe' and 'No Hire' leave status unchanged — recruiter decides

    res.json({ report: report.report, transcript: report.transcript });
  } catch (err) {
    console.error('Interview complete error:', err);
    res.status(500).json({ message: err.message });
  }
});

/* ── GET /api/interview/report/:applicationId ── */
router.get('/report/:applicationId', auth, async (req, res) => {
  try {
    const report = await InterviewReport.findOne({
      applicationId: req.params.applicationId,
      status: 'completed'
    }).sort({ completedAt: -1 });
    if (!report) return res.status(404).json({ message: 'No completed interview found' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ── GET /api/interview/reports/all ── (recruiter) */
router.get('/reports/all', auth, async (req, res) => {
  try {
    const jobs   = await Job.find({ postedBy: req.user._id }).select('_id');
    const jobIds = jobs.map(j => j._id);
    const reports = await InterviewReport.find({ jobId: { $in: jobIds }, status: 'completed' })
      .populate('candidateId', 'username email')
      .populate('jobId', 'title company')
      .sort({ completedAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ── Fallback question generator if AI fails ── */
function generateFallbackQuestions(jobTitle, skills) {
  return [
    { id:1, question:`Tell me about your background and what draws you to this ${jobTitle} role.`, type:'background', focus:'Communication and motivation', idealAnswerHints:'Clear narrative, genuine interest, relevant experience' },
    { id:2, question:`Walk me through a specific project where you used ${skills.split(',')[0] || 'your core skills'}. What was your role and what did you deliver?`, type:'technical', focus:'Core technical competency with evidence', idealAnswerHints:'Specific project, clear ownership, measurable outcome' },
    { id:3, question:`You're given a complex technical problem with a tight deadline and incomplete requirements. How do you approach it?`, type:'problem-solving', focus:'Problem-solving methodology under pressure', idealAnswerHints:'Clarify requirements, break down problem, prioritize, communicate' },
    { id:4, question:`Describe a time you disagreed with a team decision. How did you handle it and what was the outcome?`, type:'behavioral', focus:'Conflict resolution and teamwork (STAR method)', idealAnswerHints:'Specific situation, respectful approach, outcome with learning' },
    { id:5, question:`What are the biggest technical challenges in ${jobTitle} roles today, and how are you keeping your skills current?`, type:'advanced', focus:'Industry awareness and continuous learning', idealAnswerHints:'Specific trends, concrete learning steps, forward-thinking mindset' },
    { id:6, question:`Where do you see your career in 3 years, and how does this role fit into that path?`, type:'motivation', focus:'Ambition, alignment and long-term fit', idealAnswerHints:'Realistic goals, alignment with role, shows commitment' },
  ];
}

module.exports = router;
