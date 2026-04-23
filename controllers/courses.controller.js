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
      console.log('getComments called with courseId:', courseId);

      // Get comments with JOIN to USERS table for FullName and AvatarUrl
      const result = await pool.query(
        `SELECT c.commentid, c.userid, c.courseid, c.content, c.rating, c.createdat,
                u.FullName, u.AvatarUrl
         FROM Comments c
         LEFT JOIN USERS u ON c.userid = u.UserID
         WHERE c.courseid = $1
         ORDER BY c.createdat DESC`,
        [parseInt(courseId)]
      );

      console.log('getComments query result rows:', result.rows.length);

      const comments = result.rows.map(row => {
        const fullName = row.fullname || row.FullName || `User ${row.userid}`;
        const avatarUrl = row.avatarurl || row.AvatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.userid}`;

        return {
          commentId: row.commentid,
          userId: row.userid,
          courseId: row.courseid,
          content: row.content,
          rating: row.rating,
          createdAt: row.createdat,
          userName: fullName,
          avatarUrl: avatarUrl
        };
      });

      console.log('getComments returning:', comments.length, 'comments');
      res.json(comments);
    } catch (error) {
      console.error('getComments error:', error);
      res.json([]);
    }
  },

  addComment: async (req, res) => {
    try {
      const { content, rating, userId } = req.body;
      const { courseId } = req.params;

      console.log('addComment called with:', { userId, courseId, content, rating });

      const pUserId = parseInt(userId) || 1;
      const pCourseId = parseInt(courseId);

      // 1. Check if user has already reviewed this course
      const existingReview = await pool.query(
        'SELECT commentid FROM Comments WHERE courseid = $1 AND userid = $2',
        [pCourseId, pUserId]
      );

      if (existingReview.rows.length > 0) {
        return res.status(400).json({ 
          error: 'Bạn đã đánh giá khóa học này rồi. Vui lòng sử dụng tính năng chỉnh sửa để cập nhật đánh giá.',
          hasExistingReview: true
        });
      }

      // 2. Check if user has completed the course
      const progressResult = await pool.query(
        `SELECT 
          COUNT(CASE WHEN up.Status = 'completed' THEN 1 END) as completedlessons,
          COUNT(l.LessonID) as totallessons
        FROM Lessons l
        JOIN Modules m ON l.ModuleID = m.ModuleID
        LEFT JOIN UserProgress up ON l.LessonID = up.LessonID AND up.UserID = $2
        WHERE m.CourseID = $1`,
        [pCourseId, pUserId]
      );

      const progressData = progressResult.rows[0] || { completedlessons: 0, totallessons: 0 };
      const completedLessons = parseInt(progressData.completedlessons || 0);
      const totalLessons = parseInt(progressData.totallessons || 0);
      const isCourseCompleted = totalLessons > 0 && completedLessons === totalLessons;

      if (!isCourseCompleted) {
        return res.status(403).json({ 
          error: `Bạn cần hoàn thành khóa học (${completedLessons}/${totalLessons} bài) trước khi đánh giá.`,
          courseCompleted: false,
          completedLessons,
          totalLessons
        });
      }

      // 3. Insert the comment
      await pool.query(
        'INSERT INTO Comments (userid, courseid, content, rating) VALUES ($1, $2, $3, $4)',
        [
          pUserId,
          pCourseId,
          content || '',
          parseInt(rating)
        ]
      );

      res.json({ success: true });
    } catch (error) {
      console.error('addComment error:', error);
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
  },

  getTopComments: async (req, res) => {
    try {
      const { courseId } = req.params;
      console.log('getTopComments called with courseId:', courseId);

      // Get comments with JOIN to USERS table for FullName and AvatarUrl
      const result = await pool.query(
        `SELECT c.commentid, c.userid, c.courseid, c.content, c.rating, c.createdat,
                u.FullName, u.AvatarUrl
         FROM Comments c
         LEFT JOIN USERS u ON c.userid = u.UserID
         WHERE c.courseid = $1
         ORDER BY c.rating DESC, c.createdat DESC
         LIMIT 3`,
        [parseInt(courseId)]
      );

      console.log('getTopComments query result rows:', result.rows.length);

      const comments = result.rows.map(row => {
        const fullName = row.fullname || row.FullName || `User ${row.userid}`;
        const avatarUrl = row.avatarurl || row.AvatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.userid}`;

        return {
          commentId: row.commentid,
          userId: row.userid,
          courseId: row.courseid,
          content: row.content,
          rating: row.rating,
          createdAt: row.createdat,
          userName: fullName,
          avatarUrl: avatarUrl
        };
      });

      console.log('getTopComments returning:', comments.length, 'comments');
      res.json(comments);
    } catch (error) {
      console.error('getTopComments error:', error);
      res.json([]);
    }
  },

  getCourseStatistics: async (req, res) => {
    try {
      const { courseId } = req.params;
      const userId = parseInt(req.query.userId) || 1;

      console.log('getCourseStatistics called with courseId:', courseId, 'userId:', userId);

      // Get lesson statistics - simplified query with proper UserProgress join
      const lessonStats = await pool.query(
        `SELECT
          COUNT(DISTINCT l.LessonID) as totalLessons,
          COUNT(DISTINCT CASE WHEN up.Status = 'completed' THEN l.LessonID END) as completedLessons
        FROM Lessons l
        JOIN Modules m ON l.ModuleID = m.ModuleID
        LEFT JOIN UserProgress up ON l.LessonID = up.LessonID AND up.UserID = $2
        WHERE m.CourseID = $1`,
        [parseInt(courseId), userId]
      ).catch(err => {
        console.error('Lesson stats query error:', err);
        return { rows: [{ totalLessons: 0, completedLessons: 0 }] };
      });

      // Get rating statistics
      const ratingStats = await pool.query(
        `SELECT
          COUNT(*) as totalRatings,
          AVG(Rating) as averageRating
        FROM Comments
        WHERE CourseID = $1`,
        [parseInt(courseId)]
      ).catch(err => {
        console.error('Rating stats query error:', err);
        return { rows: [{ totalRatings: 0, averageRating: 0 }] };
      });

      const lessonData = lessonStats.rows[0] || { totalLessons: 0, completedLessons: 0 };
      const ratingData = ratingStats.rows[0] || { totalRatings: 0, averageRating: 0 };

      const totalLessons = parseInt(lessonData.totalLessons || 0);
      const completedLessons = parseInt(lessonData.completedLessons || 0);
      const totalRatings = parseInt(ratingData.totalRatings || 0);
      const averageRating = parseFloat(ratingData.averageRating || 0).toFixed(1);
      const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      console.log('Statistics result:', { totalLessons, completedLessons, progress, totalRatings, averageRating });

      res.json({
        totalLessons,
        completedLessons,
        progress,
        totalRatings,
        averageRating
      });
    } catch (error) {
      console.error('getCourseStatistics error:', error);
      res.json({
        totalLessons: 0,
        completedLessons: 0,
        progress: 0,
        totalRatings: 0,
        averageRating: 0
      });
    }
  },

  getRatingStatistics: async (req, res) => {
    try {
      const { courseId } = req.params;
      console.log('getRatingStatistics called with courseId:', courseId);

      const result = await pool.query(
        `SELECT
          COUNT(*) as totalratings,
          AVG(rating) as averagerating
        FROM Comments
        WHERE courseid = $1`,
        [parseInt(courseId)]
      );

      const data = result.rows[0] || { totalratings: 0, averagerating: 0 };
      const totalRatings = parseInt(data.totalratings || 0);
      const averageRating = parseFloat(data.averagerating || 0).toFixed(1);

      console.log('getRatingStatistics result:', { totalRatings, averageRating });

      res.json({
        totalRatings,
        averageRating
      });
    } catch (error) {
      console.error('getRatingStatistics error:', error);
      res.json({
        totalRatings: 0,
        averageRating: 0
      });
    }
  },

  getUserComment: async (req, res) => {
    try {
      const { courseId } = req.params;
      const userId = parseInt(req.query.userId) || 1;

      console.log('getUserComment called with courseId:', courseId, 'userId:', userId);

      const result = await pool.query(
        `SELECT c.commentid, c.userid, c.courseid, c.content, c.rating, c.createdat,
                u.FullName, u.AvatarUrl
         FROM Comments c
         LEFT JOIN USERS u ON c.userid = u.UserID
         WHERE c.courseid = $1 AND c.userid = $2`,
        [parseInt(courseId), userId]
      );

      if (result.rows.length === 0) {
        return res.json(null);
      }

      const row = result.rows[0];
      const comment = {
        commentId: row.commentid,
        userId: row.userid,
        courseId: row.courseid,
        content: row.content,
        rating: row.rating,
        createdAt: row.createdat,
        userName: row.fullname || row.FullName || `User ${row.userid}`,
        avatarUrl: row.avatarurl || row.AvatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.userid}`
      };

      console.log('getUserComment result:', comment);
      res.json(comment);
    } catch (error) {
      console.error('getUserComment error:', error);
      res.json(null);
    }
  },

  updateComment: async (req, res) => {
    try {
      const { courseId } = req.params;
      const { content, rating, userId } = req.body;

      console.log('updateComment called with:', { userId, courseId, content, rating });

      // Check if comment exists
      const existing = await pool.query(
        'SELECT commentid FROM Comments WHERE courseid = $1 AND userid = $2',
        [parseInt(courseId), parseInt(userId)]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      const commentId = existing.rows[0].commentid;

      await pool.query(
        'UPDATE Comments SET content = $1, rating = $2, createdat = NOW() WHERE commentid = $3',
        [
          content || '',
          parseInt(rating),
          commentId
        ]
      );

      res.json({ success: true, message: 'Comment updated successfully' });
    } catch (error) {
      console.error('updateComment error:', error);
      res.status(500).json({ error: error.message });
    }
  }
};
