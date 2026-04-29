const pool = require('../db');

const InstructorController = {
  // GET /api/instructor/course/:courseId?userId=X
  // Load full course tree with ownership check
  getCourseTree: async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const userId = parseInt(req.query.userId) || 0;

      // Verify ownership
      const courseResult = await pool.query(
        'SELECT * FROM Courses WHERE courseid = $1 AND userid = $2',
        [courseId, userId]
      );
      if (!courseResult.rows.length) {
        return res.status(403).json({ success: false, message: 'Không có quyền truy cập khóa học này' });
      }

      const course = courseResult.rows[0];

      // Get modules
      const modulesResult = await pool.query(
        `SELECT * FROM Modules WHERE CourseID = $1 ORDER BY COALESCE(OrderIndex, 0)`,
        [courseId]
      );

      const modules = [];
      for (const m of modulesResult.rows) {
        const modId = m.moduleid || m.ModuleID;
        // Get lessons for each module
        const lessonsResult = await pool.query(
          `SELECT * FROM Lessons WHERE ModuleID = $1 ORDER BY COALESCE(OrderIndex, 0)`,
          [modId]
        );

        modules.push({
          ModuleID: modId,
          Title: m.title || m.Title,
          Description: m.description || m.Description || '',
          OrderIndex: m.orderindex || m.OrderIndex || 0,
          lessons: lessonsResult.rows.map(l => ({
            LessonID: l.lessonid || l.LessonID,
            ModuleID: l.moduleid || l.ModuleID,
            Title: l.title || l.Title,
            Type: l.type || l.Type,
            ContentUrl: l.contenturl || l.ContentUrl || '',
            ContentHtml: l.contenthtml || l.ContentHtml || '',
            Duration: l.duration || l.Duration || 0,
            OrderIndex: l.orderindex || l.OrderIndex || 0,
            Describe: l.describe || l.Describe || '',
            Summary: l.summary || l.Summary || '',
            score: l.score || 0
          }))
        });
      }

      res.json({
        success: true,
        course: {
          CourseID: course.courseid,
          Title: course.title,
          Description: course.description,
          Level: course.level,
          Thumbnail: course.thumbnail,
          IsCompleted: course.iscompleted,
          Accept: course.accept || false,
          Feedback: course.feedback || ''
        },
        modules
      });
    } catch (err) {
      console.error('getCourseTree error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /api/instructor/modules
  createModule: async (req, res) => {
    try {
      const { CourseID, Title, userId } = req.body;
      if (!CourseID || !Title || !userId) {
        return res.status(400).json({ success: false, message: 'CourseID, Title, userId required' });
      }

      // Verify ownership
      const check = await pool.query('SELECT 1 FROM Courses WHERE courseid = $1 AND userid = $2', [parseInt(CourseID), parseInt(userId)]);
      if (!check.rows.length) return res.status(403).json({ success: false, message: 'Không có quyền' });

      const maxOrder = await pool.query(
        'SELECT COALESCE(MAX(OrderIndex), 0) + 1 as nextorder FROM Modules WHERE CourseID = $1',
        [parseInt(CourseID)]
      );

      const result = await pool.query(
        `INSERT INTO Modules (CourseID, Title, OrderIndex, CreatedAt) VALUES ($1, $2, $3, NOW()) RETURNING *`,
        [parseInt(CourseID), Title.trim(), parseInt(maxOrder.rows[0].nextorder)]
      );

      const m = result.rows[0];
      res.status(201).json({
        success: true,
        module: { ModuleID: m.moduleid, Title: m.title, OrderIndex: m.orderindex }
      });
    } catch (err) {
      console.error('createModule error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // PUT /api/instructor/modules/:id
  updateModule: async (req, res) => {
    try {
      const moduleId = parseInt(req.params.id);
      const { Title, OrderIndex, userId } = req.body;
      if (!Title) return res.status(400).json({ success: false, message: 'Title required' });

      await pool.query(
        'UPDATE Modules SET Title = $1, OrderIndex = $2 WHERE ModuleID = $3',
        [Title.trim(), parseInt(OrderIndex || 0), moduleId]
      );
      res.json({ success: true, message: 'Module updated' });
    } catch (err) {
      console.error('updateModule error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // DELETE /api/instructor/modules/:id
  deleteModule: async (req, res) => {
    try {
      const moduleId = parseInt(req.params.id);

      // Check for lessons
      const deps = await pool.query('SELECT COUNT(*) as c FROM Lessons WHERE ModuleID = $1', [moduleId]);
      if (parseInt(deps.rows[0].c) > 0) {
        return res.status(400).json({ success: false, message: 'Xóa hết lesson trong module trước' });
      }

      await pool.query('DELETE FROM Modules WHERE ModuleID = $1', [moduleId]);
      res.json({ success: true, message: 'Module deleted' });
    } catch (err) {
      console.error('deleteModule error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /api/instructor/lessons
  createLesson: async (req, res) => {
    try {
      const { ModuleID, Title, Type, userId, score } = req.body;
      if (!ModuleID || !Title || !Type) {
        return res.status(400).json({ success: false, message: 'ModuleID, Title, Type required' });
      }

      if (!['video', 'reading', 'quiz'].includes(Type)) {
        return res.status(400).json({ success: false, message: 'Invalid lesson type. Must be video, reading, or quiz' });
      }

      const maxOrder = await pool.query(
        'SELECT COALESCE(MAX(OrderIndex), 0) + 1 as nextorder FROM Lessons WHERE ModuleID = $1',
        [parseInt(ModuleID)]
      );

      const result = await pool.query(
        `INSERT INTO Lessons (ModuleID, Title, Type, ContentUrl, ContentHtml, Duration, OrderIndex, "describe", "summary", score)
         VALUES ($1, $2, $3, '', '', 0, $4, '', '', $5) RETURNING *`,
        [parseInt(ModuleID), Title.trim(), Type, parseInt(maxOrder.rows[0].nextorder), score !== undefined ? parseInt(score) : 0]
      );

      const l = result.rows[0];
      res.status(201).json({
        success: true,
        lesson: {
          LessonID: l.lessonid, ModuleID: l.moduleid,
          Title: l.title, Type: l.type, OrderIndex: l.orderindex
        }
      });
    } catch (err) {
      console.error('createLesson error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/instructor/lessons/:id
  getLessonById: async (req, res) => {
    try {
      const lessonId = parseInt(req.params.id);
      const result = await pool.query('SELECT * FROM Lessons WHERE LessonID = $1', [lessonId]);
      if (!result.rows.length) return res.status(404).json({ success: false, message: 'Lesson not found' });

      const l = result.rows[0];
      res.json({
        success: true,
        lesson: {
          LessonID: l.lessonid, ModuleID: l.moduleid,
          Title: l.title, Type: l.type,
          ContentUrl: l.contenturl || '', ContentHtml: l.contenthtml || '',
          Duration: l.duration || 0, OrderIndex: l.orderindex || 0,
          Describe: l.describe || '', Summary: l.summary || '',
          score: l.score || 0
        }
      });
    } catch (err) {
      console.error('getLessonById error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // PUT /api/instructor/lessons/:id
  updateLesson: async (req, res) => {
    try {
      const lessonId = parseInt(req.params.id);
      const { Title, Type, ContentUrl, ContentHtml, Duration, OrderIndex, Describe, Summary, score } = req.body;

      if (!Title || !Type) return res.status(400).json({ success: false, message: 'Title and Type required' });

      await pool.query(
        `UPDATE Lessons 
         SET Title=$1, Type=$2, ContentUrl=$3, ContentHtml=$4, Duration=$5, OrderIndex=$6, "describe"=$7, "summary"=$8, score=$9
         WHERE LessonID=$10`,
        [Title, Type, ContentUrl || '', ContentHtml || '', parseInt(Duration || 0), parseInt(OrderIndex || 0), Describe || '', Summary || '', score !== undefined ? parseInt(score) : 0, lessonId]
      );
      res.json({ success: true, message: 'Lesson updated' });
    } catch (err) {
      console.error('updateLesson error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // DELETE /api/instructor/lessons/:id
  deleteLesson: async (req, res) => {
    try {
      const lessonId = parseInt(req.params.id);

      // Cascade: Answers -> Questions -> Quizzes -> Lesson
      await pool.query(`DELETE FROM Answers WHERE QuestionID IN (SELECT QuestionID FROM Questions WHERE QuizID IN (SELECT QuizID FROM Quizzes WHERE LessonID = $1))`, [lessonId]);
      await pool.query(`DELETE FROM Questions WHERE QuizID IN (SELECT QuizID FROM Quizzes WHERE LessonID = $1)`, [lessonId]);
      await pool.query(`DELETE FROM Quizzes WHERE LessonID = $1`, [lessonId]);
      await pool.query('DELETE FROM Lessons WHERE LessonID = $1', [lessonId]);

      res.json({ success: true, message: 'Lesson deleted' });
    } catch (err) {
      console.error('deleteLesson error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // PUT /api/instructor/course/:courseId/submit
  submitForReview: async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const { userId } = req.body;

      const check = await pool.query('SELECT 1 FROM Courses WHERE courseid=$1 AND userid=$2', [courseId, parseInt(userId)]);
      if (!check.rows.length) return res.status(403).json({ success: false, message: 'Không có quyền' });

      // Set accept=true, iscompleted stays false → pending for admin review
      await pool.query('UPDATE Courses SET accept=true, iscompleted=false, feedback=\'\'  WHERE courseid=$1', [courseId]);
      res.json({ success: true, message: 'Đã gửi yêu cầu xuất bản! Vui lòng chờ Admin phê duyệt.' });
    } catch (err) {
      console.error('submitForReview error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = InstructorController;
