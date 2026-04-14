const pool = require('../db');

module.exports = {
  getAllCourses: async (req, res) => {
    try {
      const result = await pool.query('SELECT CourseID, Title, Description, Level, Thumbnail, CreatedAt FROM Courses WHERE iscompleted = true AND accept = true ORDER BY CreatedAt DESC');
      const mapped = result.rows.map(row => ({
          CourseID: row.courseid || row.CourseID,
          Title: row.title || row.Title,
          Description: row.description || row.Description,
          Level: row.level || row.Level,
          Thumbnail: row.thumbnail || row.Thumbnail,
          CreatedAt: row.createdat || row.CreatedAt
      }));
      res.json(mapped);
    } catch (error) {
      console.error('getAllCourses:', error);
      res.status(500).json({ error: error.message });
    }
  },

  getCourseById: async (req, res) => {
    try {
      const { id } = req.params;
      console.log('Getting course:', id);
      const result = await pool.query(
        'SELECT * FROM Courses WHERE CourseID = $1',
        [parseInt(id)]
      );
      
      let course = result.rows[0];
      if (course) {
          course = {
              ...course,
              CourseID: course.courseid || course.CourseID,
              Title: course.title || course.Title,
              Description: course.description || course.Description,
              Level: course.level || course.Level,
              Thumbnail: course.thumbnail || course.Thumbnail,
              CreatedAt: course.createdat || course.CreatedAt
          };
      }
      res.json(course || null);
    } catch (error) {
      console.error('getCourseById:', id, error.message);
      res.status(404).json(null);
    }
  },

  getCourseModulesLessons: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = parseInt(req.query.userId) || 1;
      console.log('Getting modules for course:', id, 'user:', userId);
      const result = await pool.query(
        `SELECT 
          m.ModuleID, m.Title as ModuleTitle, m.OrderIndex as ModuleOrder,
          l.LessonID, l.Title as LessonTitle, l.Type, l.ContentUrl, l.Duration, l.OrderIndex as LessonOrder,
          CASE WHEN up.Status = 'completed' THEN 1 ELSE 0 END as completed
        FROM Courses c
        JOIN Modules m ON c.CourseID = m.CourseID
        JOIN Lessons l ON m.ModuleID = l.ModuleID
        LEFT JOIN UserProgress up ON up.LessonID = l.LessonID AND up.UserID = $2 AND up.Status = 'completed'
        WHERE c.CourseID = $1
        ORDER BY m.OrderIndex, l.OrderIndex`,
        [
          parseInt(id),
          userId
        ]
      );
      
      const modulesTree = {};
      result.rows.forEach(row => {
        // use lower case property names just in case if PG returns them lowercased, actually PG preserves case if quoted, but unquoted is lowercased.
        const modId = row.ModuleID || row.moduleid;
        if (!modulesTree[modId]) {
          modulesTree[modId] = {
            id: modId,
            title: row.ModuleTitle || row.moduletitle,
            lessons: []
          };
        }
        modulesTree[modId].lessons.push({
          id: row.LessonID || row.lessonid,
          title: row.LessonTitle || row.lessontitle,
          type: row.Type || row.type,
          duration: row.Duration || row.duration,
          status: 'available',
          completed: !!row.completed
        });
      });
      
      res.json(Object.values(modulesTree));
    } catch (error) {
      console.error('getCourseModulesLessons:', id, error.message);
      res.status(404).json([]);
    }
  },

  getLessonById: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        'SELECT * FROM Lessons WHERE LessonID = $1',
        [parseInt(id)]
      );
      
      // Handle lowercase props fallback
      let lessonRow = result.rows[0];
      if (lessonRow) {
        lessonRow = {
          Type: lessonRow.Type || lessonRow.type,
          Title: lessonRow.Title || lessonRow.title,
          ContentHtml: lessonRow.ContentHtml || lessonRow.contenthtml,
          ContentUrl: lessonRow.ContentUrl || lessonRow.contenturl,
          Describe: lessonRow.describe || lessonRow.Describe || '',
          Summary: lessonRow.summary || lessonRow.Summary || '',
          ...lessonRow
        }
      }

      let lesson = lessonRow || {
        Type: 'reading',
        Title: 'Lesson Not Found',
        ContentHtml: '<h2>No Lesson Data</h2><p>This lesson needs to be added to the database.</p>'
      };
      
      if (lesson.Type === 'video' && lesson.ContentUrl) {
        const videoId = lesson.ContentUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1];
        lesson.embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : lesson.ContentUrl;
      }
      
      res.json(lesson);
    } catch (error) {
      console.error('getLessonById:', error);
      res.status(404).json({ Type: 'reading', Title: 'Error', ContentHtml: '<h2>Lesson Error</h2>' });
    }
  },



  getQuizByLessonId: async (req, res) => {
    try {
      const { lessonId } = req.params;
      const result = await pool.query(`
        SELECT q.Title,
          qst.QuestionID, qst.QuestionText, qst.Explanation,
          a.AnswerID, a.AnswerText, a.IsCorrect
        FROM Quizzes q
        JOIN Questions qst ON q.QuizID = qst.QuizID
        LEFT JOIN Answers a ON qst.QuestionID = a.QuestionID
        WHERE q.LessonID = $1
        ORDER BY qst.QuestionID, a.AnswerID
      `, [parseInt(lessonId)]);
      
      const quiz = { questions: [] };
      result.rows.forEach(row => {
        const qid = row.QuestionID || row.questionid;
        let q = quiz.questions.find(x => x.id === qid);
        if (!q) {
          q = {
            id: qid,
            question: row.QuestionText || row.questiontext,
            explanation: row.Explanation || row.explanation || '',
            options: [],
            correctAnswer: -1
          };
          quiz.questions.push(q);
        }
        q.options.push(row.AnswerText || row.answertext);
        if (row.IsCorrect || row.iscorrect) q.correctAnswer = q.options.length - 1;
      });
      
      res.json(quiz);
    } catch (error) {
      res.json({ questions: [] });
    }
  },

  completeLesson: async (req, res) => {
    try {
      const { userId, lessonId } = req.body;
      if (!userId || !lessonId) {
        return res.status(400).json({ error: 'userId and lessonId required' });
      }

      const pUserId = parseInt(userId);
      const pLessonId = parseInt(lessonId);

      // 1. Mark current lesson as completed
      const curExists = await pool.query('SELECT 1 FROM UserProgress WHERE UserID = $1 AND LessonID = $2', [pUserId, pLessonId]);
      if (curExists.rows.length > 0) {
          await pool.query('UPDATE UserProgress SET Status = $3, CompletedAt = NOW() WHERE UserID = $1 AND LessonID = $2', [pUserId, pLessonId, 'completed']);
      } else {
          await pool.query('INSERT INTO UserProgress (UserID, LessonID, Status, CompletedAt) VALUES ($1, $2, $3, NOW())', [pUserId, pLessonId, 'completed']);
      }

      // 2. Check if lesson type is quiz
      const lessonQuery = await pool.query(`
        SELECT l.Type as type, l.OrderIndex as orderindex, m.OrderIndex as moduleorder, m.CourseID as courseid
        FROM Lessons l
        JOIN Modules m ON l.ModuleID = m.ModuleID
        WHERE l.LessonID = $1
      `, [
        parseInt(lessonId)
      ]);

      const lessonData = lessonQuery.rows[0];

      res.json({ success: true, message: 'Lesson marked as completed' });
    } catch (error) {
      console.error('completeLesson error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  getCourseProgress: async (req, res) => {
    try {
      const { courseId } = req.params;
      const userId = parseInt(req.query.userId) || 1;
      
      const result = await pool.query(`
        SELECT 
          COUNT(CASE WHEN up.Status = 'completed' THEN 1 END) as completedlessons,
          COUNT(l.LessonID) as totallessons
        FROM Lessons l
        JOIN Modules m ON l.ModuleID = m.ModuleID
        JOIN Courses c ON m.CourseID = c.CourseID
        LEFT JOIN UserProgress up ON up.LessonID = l.LessonID AND up.UserID = $2
        WHERE c.CourseID = $1
      `, [
        parseInt(courseId),
        userId
      ]);

      const stats = result.rows[0] || { completedlessons: 0, totallessons: 0 };
      const completedLessons = parseInt(stats.completedlessons || 0);
      const totalLessons = parseInt(stats.totallessons || 0);

      const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      const courseCompleted = progress === 100;

      res.json({
        completedLessons: completedLessons,
        totalLessons: totalLessons,
        progress,
        courseCompleted
      });
    } catch (error) {
      console.error('getCourseProgress error:', error);
      res.status(500).json({ completedLessons: 0, totalLessons: 0, progress: 0, courseCompleted: false });
    }
  },

  updateProgress: async (req, res) => {
    res.status(410).json({ message: 'Use POST /api/lesson/complete instead' });
  },

  getComments: async (req, res) => {
    try {
      const { courseId } = req.params;
      const result = await pool.query(
        'SELECT * FROM Comments WHERE CourseID = $1 ORDER BY CreatedAt DESC',
        [parseInt(courseId)]
      );
      res.json(result.rows);
    } catch (error) {
      res.json([]);
    }
  },

  addComment: async (req, res) => {
    try {
      const { content, rating } = req.body;
      const { courseId } = req.params;
      const userId = 1;
      
      await pool.query(
        'INSERT INTO Comments (UserID, CourseID, Content, Rating) VALUES ($1, $2, $3, $4)',
        [
          userId,
          parseInt(courseId),
          content,
          parseInt(rating)
        ]
      );
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getUserProgress: async (req, res) => {
    try {
      const userId = 1;
      const result = await pool.query(
        'SELECT COUNT(CASE WHEN Status = \'completed\' THEN 1 END) as completed, COUNT(*) as total FROM UserProgress WHERE UserID = $1',
        [userId]
      );
      
      const data = result.rows[0] || { completed: 0, total: 0 };
      const completed = parseInt(data.completed || 0);
      const total = parseInt(data.total || 0);

      res.json({
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        completed: completed,
        total: total
      });
    } catch (error) {
      res.json({ percentage: 0, completed: 0, total: 0 });
    }
  }
};
