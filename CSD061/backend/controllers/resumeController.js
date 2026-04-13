const multer = require('multer');
const path = require('path');
const fs = require('fs');
const geminiService = require('../utils/geminiService');
const User = require('../models/User');
const Skill = require('../models/Skill');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/resumes';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(pdf|doc|docx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX files are allowed'), false);
    }
  }
});

async function extractTextFromPDF(filePath) {
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (err) {
    console.error('pdf-parse error:', err.message);
    return 'Resume file uploaded. Extract skills and work experience from context.';
  }
}

const uploadResume = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;
    console.log('Resume uploaded:', filePath);

    const extractedText = await extractTextFromPDF(filePath);
    console.log('Extracted text length:', extractedText.length);

    const resumeAnalysis = await geminiService('analyzeResume', { resumeText: extractedText });
    console.log('Resume analysis done:', JSON.stringify(resumeAnalysis, null, 2));

    await updateUserProfile(userId, resumeAnalysis, originalName, req.file.filename);

    // Delete temp file
    try { fs.unlinkSync(filePath); } catch (e) {}

    res.json({
      message: 'Resume processed successfully',
      fileName: originalName,
      analysis: resumeAnalysis
    });

  } catch (error) {
    console.error('Resume upload error:', error);
    res.status(500).json({ message: 'Failed to process resume: ' + error.message });
  }
};

function categoriseSkill(skillName) {
  const s = skillName.toLowerCase();
  if (/react|vue|angular|html|css|tailwind|bootstrap|svelte|next|nuxt|jquery/.test(s)) return 'Frontend';
  if (/node|express|django|flask|spring|rails|laravel|fastapi|nest/.test(s)) return 'Backend';
  if (/mongo|mysql|postgres|sqlite|redis|cassandra|dynamodb|oracle|sql/.test(s)) return 'Database';
  if (/docker|kubernetes|k8s|jenkins|ci\/cd|ansible|terraform|helm/.test(s)) return 'DevOps';
  if (/aws|azure|gcp|cloud|firebase|heroku|vercel|netlify/.test(s)) return 'Cloud';
  if (/machine learning|deep learning|tensorflow|pytorch|keras|nlp|cv|scikit|pandas|numpy|ai|ml/.test(s)) return 'AI/ML';
  if (/power bi|tableau|excel|analytics|looker|data studio|qlik/.test(s)) return 'Analytics';
  if (/git|github|gitlab|bitbucket|svn/.test(s)) return 'Version Control';
  if (/rest|graphql|api|postman|swagger|grpc/.test(s)) return 'API';
  if (/figma|sketch|adobe|photoshop|illustrator|ux|ui design/.test(s)) return 'Design';
  if (/agile|scrum|jira|product|roadmap|kanban/.test(s)) return 'Product';
  if (/communication|leadership|teamwork|problem.solving|time management|critical thinking/.test(s)) return 'Soft Skills';
  if (/python|java|javascript|typescript|c\+\+|c#|go|rust|kotlin|swift|php|ruby|scala/.test(s)) return 'Programming';
  return 'General';
}

// No RegExp — uses collation for case-insensitive exact match
async function saveSkillsToDatabase(skills = []) {
  if (!skills.length) return;
  try {
    for (const skillName of skills) {
      const name = skillName.trim();
      const exists = await Skill.findOne({ name }).collation({ locale: 'en', strength: 2 });
      if (!exists) {
        await Skill.create({ name, category: categoriseSkill(name), demandScore: 1, trending: false });
      }
    }
    console.log('Skills DB - processed ' + skills.length + ' skills');
  } catch (err) {
    console.error('saveSkillsToDatabase error:', err.message);
  }
}

async function updateUserProfile(userId, resumeAnalysis, resumeName, resumeFilename) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const extractedSkills = resumeAnalysis.skills || [];
    const mergedSkills = [...new Set([...(user.skills || []), ...extractedSkills])];

    await saveSkillsToDatabase(extractedSkills);

    const extractedExp = resumeAnalysis.experience || [];
    const formattedExperience = extractedExp.map(exp => ({
      title:       exp.title || exp.role || '',
      company:     exp.company || '',
      startDate:   parseDurationStart(exp.duration || exp.period || ''),
      endDate:     parseDurationEnd(exp.duration || exp.period || ''),
      description: exp.description || exp.responsibilities || '',
    }));

    const extractedEdu = resumeAnalysis.education || [];
    const formattedEducation = extractedEdu.map(edu => ({
      degree:      edu.degree || '',
      institution: edu.institution || '',
      field:       edu.field || edu.degree || '',
      startYear:   edu.year || '',
      endYear:     edu.year || '',
    }));

    const updateData = {
      skills:         mergedSkills,
      currentCompany: resumeAnalysis.currentCompany || user.currentCompany || '',
      resumeName:     resumeName     || user.resumeName || '',
      resumeUrl:      resumeFilename ? `/uploads/resumes/${resumeFilename}` : user.resumeUrl || '',
    };

    if (resumeAnalysis.personalInfo) {
      const pi = resumeAnalysis.personalInfo;
      if (pi.phone    && !user.phone)    updateData.phone    = pi.phone;
      if (pi.location && !user.location) updateData.location = pi.location;
    }

    if (formattedExperience.length > 0) {
      const existing = user.experience || [];
      const existingKeys = new Set(existing.map(e => e.title + '|' + e.company));
      const newExp = formattedExperience.filter(e => !existingKeys.has(e.title + '|' + e.company));
      updateData.experience = [...existing, ...newExp];
    }

    if (formattedEducation.length > 0) {
      const existing = user.education || [];
      const existingKeys = new Set(existing.map(e => e.degree + '|' + e.institution));
      const newEdu = formattedEducation.filter(e => !existingKeys.has(e.degree + '|' + e.institution));
      updateData.education = [...existing, ...newEdu];
    }

    if (resumeAnalysis.currentRole) {
      updateData['careerGoals.currentRole'] = resumeAnalysis.currentRole;
    }

    await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true });

    console.log('Profile updated - Skills: ' + mergedSkills.length + ' | Exp: ' + formattedExperience.length + ' | Edu: ' + formattedEducation.length);
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

function parseDurationStart(duration) {
  if (!duration) return null;
  const parts = duration.split(/[-–]/);
  if (parts.length >= 1) {
    const d = new Date(parts[0].trim());
    return isNaN(d) ? null : d;
  }
  return null;
}

function parseDurationEnd(duration) {
  if (!duration) return null;
  const lower = duration.toLowerCase();
  if (lower.includes('present') || lower.includes('current')) return null;
  const parts = duration.split(/[-–]/);
  if (parts.length >= 2) {
    const d = new Date(parts[1].trim());
    return isNaN(d) ? null : d;
  }
  return null;
}

module.exports = { uploadResume, upload };