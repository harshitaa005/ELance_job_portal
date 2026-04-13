// backend/routes/chat.js
// .env mein: GROQ_API_KEY=gsk_xxxxxxxx

const express = require('express');
const router  = express.Router();

const SYSTEM_PROMPT = `You are Sam, a friendly and expert career assistant for Elance — an AI-powered recruitment platform.

You answer questions related to:
- Job search and job applications
- Resume and CV writing, formatting, improvement
- Interview preparation and tips
- Career growth strategies and roadmaps
- Salary negotiation
- Skill development for career purposes
- Career transitions and pivots
- Programming languages and tech skills — both career-related AND general learning questions
  (e.g. "what is Python", "what is machine learning", "how does JavaScript work", "what is blockchain", "what is React", "explain OOP", "what is Java", "what is C++", etc.)
- Software development concepts, tools, frameworks, and technologies
- Computer science concepts

STRICT RULE: If the user asks about topics completely unrelated to careers, jobs, or technology — such as cooking, entertainment, sports, history, general science, or completely unrelated knowledge — you must refuse politely and redirect them. Respond with: "I'm Sam, your career assistant! I can only help with job-related topics, tech skills, and programming. Is there something career or tech-related I can help you with? 😊"

IMPORTANT: Always answer programming language and technology questions freely and helpfully. Questions like "what is Python", "what is blockchain", "explain machine learning", "what is Java", "what is a variable" are WELCOME and you should answer them clearly and concisely.

Keep responses concise, practical, warm, and encouraging.
Use bullet points for lists. Be specific and actionable.`;

router.post('/', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ reply: 'Please send a message.' });
    }

    const msgs = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-8).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || m.text || ''),
      })),
      { role: 'user', content: message.trim() },
    ];

    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // ── No key configured ──────────────────────────────────────────────────
    if (!groqKey && !openaiKey) {
      console.error('ERROR: No AI API key set in .env!');
      return res.json({
        reply: '⚠️ AI not configured. Please add GROQ_API_KEY=gsk_xxx to your backend .env file and restart server.',
      });
    }

    // ── Try Groq first ─────────────────────────────────────────────────────
    if (groqKey) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
            messages: msgs,
            max_tokens: 800,
            temperature: 0.7,
          }),
        });

        if (!groqRes.ok) {
          const errBody = await groqRes.text().catch(() => '');
          console.error(`Groq error ${groqRes.status}:`, errBody);
          throw new Error(`Groq ${groqRes.status}: ${errBody}`);
        }

        const data = await groqRes.json();
        const reply = data.choices?.[0]?.message?.content;
        if (!reply) throw new Error('Empty Groq response');
        return res.json({ reply });

      } catch (e) {
        console.error('Groq failed:', e.message);
        if (!openaiKey) {
          return res.json({ reply: 'AI service temporarily unavailable. Please try again shortly.' });
        }
      }
    }

    // ── Fallback to OpenAI ─────────────────────────────────────────────────
    if (openaiKey) {
      const oRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: msgs,
          max_tokens: 800,
        }),
      });

      if (!oRes.ok) throw new Error(`OpenAI ${oRes.status}`);
      const oData = await oRes.json();
      const reply = oData.choices?.[0]?.message?.content;
      return res.json({ reply: reply || 'No response generated.' });
    }

  } catch (err) {
    console.error('Chat route error:', err.message);
    res.json({ reply: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
