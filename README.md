# 🚀 ELance - Job Portal

A full-stack job portal web application that connects job seekers with recruiters. Built with React.js on the frontend and Node.js/Express on the backend, with MongoDB as the database.

🌐 **Live Demo:** [e-lance-job-portal.vercel.app](https://e-lance-job-portal.vercel.app)

---

## ✨ Features

### For Job Seekers
- 🔍 Search and filter jobs by title, location, and category
- 📄 Upload and manage resume
- 📝 Apply to jobs and track application status
- 💬 Real-time messaging with recruiters
- 📊 Analytics dashboard for application insights
- 🤖 AI-powered career path planner
- 🔔 Job alerts and saved jobs
- 👤 Profile management

### For Recruiters
- 📢 Post and manage job listings
- 📋 View and manage applications
- 🎥 AI Interview Room for conducting interviews
- 📅 Schedule interviews with candidates
- 📊 Recruiter analytics dashboard
- 💬 Messaging with candidates

### General
- 🔐 Secure authentication with OTP verification
- 🤖 AI Chatbot powered by Google Gemini
- 📱 Fully responsive design

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React.js 19 | UI Framework |
| React Router DOM | Navigation |
| Material UI (MUI) | Component Library |
| Tailwind CSS | Styling |
| Chart.js / Recharts | Data Visualization |
| Axios | API Calls |
| Lucide React | Icons |

### Backend
| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express.js 5 | Web Framework |
| MongoDB + Mongoose | Database |
| JWT | Authentication |
| Bcrypt.js | Password Hashing |
| Multer | File Upload |
| Nodemailer | Email Service |
| Google Gemini AI | AI Features |
| Groq SDK | AI Chatbot |
| PDF Parse | Resume Parsing |

---

## 📁 Project Structure

```
CSD061/
├── frontend/               # React.js Application
│   ├── public/
│   └── src/
│       ├── components/     # Reusable UI components
│       │   ├── auth/       # Login, Signup, OTP
│       │   ├── recruiter/  # Recruiter-specific pages
│       │   └── ...
│       ├── pages/          # Page components
│       ├── services/       # API service functions
│       └── App.js
│
└── backend/                # Node.js/Express API
    ├── config/             # Database configuration
    ├── controllers/        # Request handlers
    ├── middleware/         # Auth middleware
    ├── models/             # MongoDB schemas
    ├── routes/             # API routes
    ├── utils/              # Helper functions
    └── server.js
```

---

## ⚙️ Getting Started

### Prerequisites
- Node.js (v16+)
- MongoDB
- npm

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/harshitaa005/ELance_job_portal.git
cd ELance_job_portal/CSD061
```

**2. Setup Backend**
```bash
cd backend
npm install
```

Create a `.env` file in the `backend` folder:
```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email
EMAIL_PASS=your_email_password
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
```

Start the backend:
```bash
npm start
```

**3. Setup Frontend**
```bash
cd ../frontend
npm install
```

Create a `.env` file in the `frontend` folder:
```env
REACT_APP_API_URL=http://localhost:5000
```

Start the frontend:
```bash
npm start
```

The app will run at `http://localhost:3000`

---

## 🚀 Deployment

- **Frontend:** Deployed on [Vercel](https://vercel.com)
- **Backend:** Can be deployed on Railway, Render, or any Node.js hosting

---

## 📄 License

This project is developed as an academic project (CSD061).
