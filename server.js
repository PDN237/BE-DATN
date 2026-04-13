const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoute = require('./auth.route');
const problemsRoute = require('./problems.route');
const submitRoute = require('./routes/submit.route');
const coursesRoute = require('./routes/courses.route');
const adminRoute = require('./routes/admin.route');
const profileRoute = require('./routes/profile.route');
const aiCoachRoute = require('./controllers/AICoach');
const instructorRoute = require('./routes/instructor.route');
const informationRoute = require('./routes/information.route');

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from FrondEnd directory
app.use(express.static(path.join(__dirname, '../FrondEnd')));

// API routes
app.use('/api/auth', authRoute);
app.use('/api/problems', problemsRoute);
app.use('/api/submit', submitRoute);
app.use('/api/courses', coursesRoute);
app.use('/api/admin', adminRoute);
app.use('/api/profile', profileRoute);
app.use('/api/aicoach', aiCoachRoute);
app.use('/api/instructor', instructorRoute);
app.use('/api/information', informationRoute);



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
});
