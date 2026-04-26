const pool = require('../../db.js');

const CourseController = {
  createCourse: async (req, res) => {
    try {
      const { Title, Description, Level, Thumbnail } = req.body;
      
      if (!Title || !Description) {
        return res.status(400).json({ error: 'Title and Description required' });
      }
      
      const result = await pool.query(
        `INSERT INTO Courses (Title, Description, Level, Thumbnail, CreatedAt, score)
         VALUES ($1, $2, $3, $4, NOW(), $5)
         RETURNING *`,
        [
          Title,
          Description,
          Level || 'Cơ bản',
          Thumbnail || '',
          score !== undefined ? parseInt(score) : 0
        ]
      );
      
      let c = result.rows[0];
      c = c ? { ...c, CourseID: c.courseid || c.CourseID, Title: c.title || c.Title, Description: c.description || c.Description, Level: c.level || c.Level, Thumbnail: c.thumbnail || c.Thumbnail, CreatedAt: c.createdat || c.CreatedAt } : null;
      
      res.status(201).json({
        success: true,
        course: c,
        message: 'Course created successfully'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAllCourses: async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const size = Math.max(1, Math.min(50, parseInt(req.query.size) || 10));
      const search = (req.query.search || '').trim();
      const offset = (page - 1) * size;
      
      const searchParam = `%${search}%`;
      const useSearch = search.length > 0;
      
      const mainParams = [size, offset]; // $1 = limit, $2 = offset
      const mainWhereClause = useSearch ? `AND c.Title LIKE $3` : '';
      if (useSearch) {
        mainParams.push(searchParam);
      }
      
      const coursesResult = await pool.query(
        `SELECT c.CourseID, c.Title, c.Description, c.Level, c.Thumbnail, c.CreatedAt,
          c.iscompleted, c.accept, c.feedback, c.userid, c.score,
          COUNT(m.ModuleID) as moduleCount
         FROM Courses c
         LEFT JOIN Modules m ON c.CourseID = m.CourseID
         WHERE c.accept = true ${mainWhereClause}
         GROUP BY c.CourseID, c.Title, c.Description, c.Level, c.Thumbnail, c.CreatedAt, c.iscompleted, c.accept, c.feedback, c.userid, c.score
         ORDER BY c.CreatedAt DESC
         LIMIT $1 OFFSET $2`,
        mainParams
      );
      
      let countResult;
      if (useSearch) {
        countResult = await pool.query(
          `SELECT COUNT(*) as total FROM Courses c WHERE c.accept = true AND c.Title LIKE $1`,
          [searchParam]
        );
      } else {
        countResult = await pool.query(
          `SELECT COUNT(*) as total FROM Courses WHERE accept = true`
        );
      }
      
      const courses = (coursesResult.rows || []).map(row => ({
          ...row,
          CourseID: row.courseid || row.CourseID,
          Title: row.title || row.Title,
          Description: row.description || row.Description,
          Level: row.level || row.Level,
          Thumbnail: row.thumbnail || row.Thumbnail,
          CreatedAt: row.createdat || row.CreatedAt,
          IsCompleted: row.iscompleted || false,
          Accept: row.accept || false,
          Feedback: row.feedback || '',
          UserId: row.userid,
          moduleCount: parseInt(row.modulecount || row.moduleCount || 0)
      }));
      const total = parseInt(countResult.rows[0]?.total || 0);
      
      
      res.json({
        courses: courses,
        pagination: {
          page,
          size,
          total,
          totalPages: Math.ceil(total / size)
        }
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to load courses: ' + error.message,
        debug: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  },

  getCourseById: async (req, res) => {
    try {
      const id = req.params.id || req.params.courseId;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid course ID' });
      }
      
      let courseResult;
      try {
        courseResult = await pool.query(
          `SELECT * FROM Courses WHERE CourseID = $1`,
          [parseInt(id)]
        );
      } catch (courseErr) {
        return res.status(404).json({Title: 'Course Not Found', modules: []});
      }

      if (!courseResult?.rows?.length) {
        return res.json({Title: 'Empty Course Builder', modules: []});
      }
      
      let modules = [];
      try {
        const modulesResult = await pool.query(
          `SELECT m.*, 
           (SELECT COUNT(*) FROM Lessons l WHERE l.ModuleID = m.ModuleID) as lessonCount
         FROM Modules m 
         WHERE m.CourseID = $1
         ORDER BY COALESCE(m.OrderIndex, 0)`,
          [parseInt(id)]
        );

        modules = (modulesResult.rows || []).map(m => ({
            ...m,
            ModuleID: m.moduleid || m.ModuleID,
            CourseID: m.courseid || m.CourseID,
            Title: m.title || m.Title,
            Description: m.description || m.Description,
            OrderIndex: m.orderindex || m.OrderIndex,
            lessonCount: m.lessoncount || m.lessonCount
        }));
        
        // Nest lessons for each module
        for (const module of modules) {
          try {
            const lessonsResult = await pool.query(
              `SELECT * FROM Lessons WHERE ModuleID = $1 ORDER BY COALESCE(OrderIndex, 0)`,
              [parseInt(module.ModuleID || module.moduleid)]
            );
            module.lessons = (lessonsResult.rows || []).map(l => ({
              ...l,
              LessonID: l.lessonid || l.LessonID,
              ModuleID: l.moduleid || l.ModuleID,
              Title: l.title || l.Title,
              Type: l.type || l.Type,
              Duration: l.duration || l.Duration,
              OrderIndex: l.orderindex || l.OrderIndex,
              ContentUrl: l.contenturl || l.ContentUrl,
              ContentHtml: l.contenthtml || l.ContentHtml,
              Describe: l.describe || l.Describe || '',
              Summary: l.summary || l.Summary || '',
              score: l.score || l.Score || 0
            }));

            // Load quizzes for each lesson
            for (const lesson of module.lessons) {
              try {
                const quizzesResult = await pool.query(
                  `SELECT q.* FROM Quizzes q WHERE q.LessonID = $1`,
                  [parseInt(lesson.LessonID)]
                );
                lesson.quizzes = (quizzesResult.rows || []).map(q => ({
                  ...q,
                  QuizID: q.quizid || q.QuizID,
                  LessonID: q.lessonid || q.LessonID,
                  Title: q.title || q.Title
                }));

                // Load questions for each quiz
                for (const quiz of lesson.quizzes) {
                  try {
                    const questionsResult = await pool.query(
                      `SELECT qst.* FROM Questions qst WHERE qst.QuizID = $1`,
                      [parseInt(quiz.QuizID)]
                    );
                    quiz.questions = (questionsResult.rows || []).map(qst => ({
                      ...qst,
                      QuestionID: qst.questionid || qst.QuestionID,
                      QuizID: qst.quizid || qst.QuizID,
                      QuestionText: qst.questiontext || qst.QuestionText,
                      QuestionType: qst.questiontype || qst.QuestionType
                    }));

                    // Load answers for each question
                    for (const question of quiz.questions) {
                      try {
                        const answersResult = await pool.query(
                          `SELECT a.* FROM Answers a WHERE a.QuestionID = $1`,
                          [parseInt(question.QuestionID)]
                        );
                        question.answers = (answersResult.rows || []).map(a => ({
                          ...a,
                          AnswerID: a.answerid || a.AnswerID,
                          QuestionID: a.questionid || a.QuestionID,
                          AnswerText: a.answertext || a.AnswerText,
                          IsCorrect: a.iscorrect || a.IsCorrect
                        }));
                      } catch (ansErr) {
                                    question.answers = [];
                      }
                    }
                  } catch (qstErr) {
                            quiz.questions = [];
                  }
                }
              } catch (quizErr) {
                    lesson.quizzes = [];
              }
            }
          } catch (lessErr) {
            module.lessons = [];
          }
        }
      } catch (modErr) {
        modules = [];
      }
      
      let course = courseResult.rows[0];
      if (course) {
          course = {
              ...course,
              CourseID: course.courseid || course.CourseID,
              Title: course.title || course.Title,
              Description: course.description || course.Description,
              Level: course.level || course.Level,
              Thumbnail: course.thumbnail || course.Thumbnail,
              CreatedAt: course.createdat || course.CreatedAt,
              modules: modules
          };
      }
      res.json(course || null);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateCourse: async (req, res) => {
    try {
      const { id } = req.params;
      const courseId = parseInt(id);
      
      const { Title, Description, Level, Thumbnail } = req.body;
      
      if (!Title || !Description) {
        return res.status(400).json({ error: 'Title and Description required' });
      }
      
      const existsResult = await pool.query(
        'SELECT CourseID, Title FROM Courses WHERE CourseID = $1',
        [courseId]
      );
      const exists = existsResult.rows || [];
      
      if (!exists.length) {
        return res.status(404).json({ error: `Course ${courseId} not found` });
      }
      
      await pool.query(
        `UPDATE Courses 
         SET Title = $2, Description = $3, Level = $4, 
             Thumbnail = $5, UpdatedAt = NOW(), score = $6
         WHERE CourseID = $1`,
        [
          courseId,
          Title,
          Description,
          Level || 'Cơ bản',
          Thumbnail || '',
          score !== undefined ? parseInt(score) : 0
        ]
      );
      
      res.json({ success: true, message: 'Course updated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteCourse: async (req, res) => {
    try {
      const { id } = req.params;
      const courseId = parseInt(id);
      
      
      const modulesResult = await pool.query(
        'SELECT COUNT(*) as count FROM Modules WHERE CourseID = $1',
        [courseId]
      );
      const modules = modulesResult.rows?.[0] || { count: 0 };
      
      if (parseInt(modules.count) > 0) {
        return res.status(400).json({
          error: 'Cannot delete course with modules',
          details: { modules: parseInt(modules.count) }
        });
      }
      
      const courseResult = await pool.query(
        'SELECT COUNT(*) as count FROM Courses WHERE CourseID = $1',
        [courseId]
      );
      const courseExists = courseResult.rows?.[0] || { count: 0 };
      
      if (parseInt(courseExists.count) === 0) {
        return res.status(404).json({ error: 'Course not found' });
      }
      
      const deleteResult = await pool.query(
        'DELETE FROM Courses WHERE CourseID = $1',
        [courseId]
      );
      
      res.json({ success: true, message: 'Course deleted successfully' });
    } catch (error) {
      res.status(500).json({ 
        error: 'Delete failed: ' + error.message,
        debug: process.env.NODE_ENV === 'development' ? error.stack : undefined 
      });
    }
  },

  // PUT /api/admin/courses/:id/approve
  approveCourse: async (req, res) => {
    try {
      const courseId = parseInt(req.params.id);
      await pool.query(
        `UPDATE Courses SET accept = true, iscompleted = true, feedback = '' WHERE CourseID = $1`,
        [courseId]
      );
      res.json({ success: true, message: 'Khóa học đã được phê duyệt và xuất bản!' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // PUT /api/admin/courses/:id/reject
  rejectCourse: async (req, res) => {
    try {
      const courseId = parseInt(req.params.id);
      const { feedback } = req.body;
      await pool.query(
        `UPDATE Courses SET accept = false, iscompleted = false, feedback = $2 WHERE CourseID = $1`,
        [courseId, feedback || '']
      );
      res.json({ success: true, message: 'Đã từ chối khóa học và gửi feedback.' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // PUT /api/admin/courses/:id/unpublish
  unpublishCourse: async (req, res) => {
    try {
      const courseId = parseInt(req.params.id);
      await pool.query(
        `UPDATE Courses SET accept = true, iscompleted = false, feedback = '' WHERE CourseID = $1`,
        [courseId]
      );
      res.json({ success: true, message: 'Đã hủy xuất bản khóa học thành công.' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = CourseController;
