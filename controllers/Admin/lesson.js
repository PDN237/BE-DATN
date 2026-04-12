const pool = require('../../db.js');

const LessonController = {
  createLesson: async (req, res) => {
    try {
      const { ModuleID, Title, Type, ContentUrl, ContentHtml, Duration, OrderIndex, Describe, Summary } = req.body;
      
      if (!ModuleID || !Title || !Type) {
        return res.status(400).json({ error: 'ModuleID, Title, and Type required' });
      }
      
      if (!['video', 'reading', 'quiz'].includes(Type)) {
        return res.status(400).json({ error: 'Invalid lesson type' });
      }
      
      const result = await pool.query(
        `INSERT INTO Lessons (ModuleID, Title, Type, ContentUrl, ContentHtml, Duration, OrderIndex, "describe", "summary")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          parseInt(ModuleID),
          Title,
          Type,
          ContentUrl || '',
          ContentHtml || '',
          parseInt(Duration || 0),
          parseInt(OrderIndex || 0),
          Describe || '',
          Summary || ''
        ]
      );
      
      let l = result.rows[0];
      l = l ? { ...l, LessonID: l.lessonid || l.LessonID, ModuleID: l.moduleid || l.ModuleID, Title: l.title || l.Title, Type: l.type || l.Type, ContentUrl: l.contenturl || l.ContentUrl, ContentHtml: l.contenthtml || l.ContentHtml, Duration: l.duration || l.Duration, OrderIndex: l.orderindex || l.OrderIndex, Describe: l.describe || l.Describe || '', Summary: l.summary || l.Summary || '' } : null;

      res.status(201).json({
        success: true,
        lesson: l,
        message: 'Lesson created successfully'
      });
    } catch (error) {
      console.error('createLesson:', error);
      res.status(500).json({ error: error.message });
    }
  },

  getLessonsByModule: async (req, res) => {
    try {
      const { moduleId } = req.params;
      
      const result = await pool.query(
        `SELECT l.*, 
          CASE 
            WHEN l.Type = 'quiz' THEN (SELECT COUNT(*) FROM Quizzes q WHERE q.LessonID = l.LessonID)
            ELSE 0 
          END as quizCount
         FROM Lessons l 
         WHERE l.ModuleID = $1
         ORDER BY l.OrderIndex, l.LessonID`,
        [parseInt(moduleId)]
      );
      
      res.json(result.rows.map(l => ({
        ...l,
        LessonID: l.lessonid || l.LessonID,
        ModuleID: l.moduleid || l.ModuleID,
        Title: l.title || l.Title,
        Type: l.type || l.Type,
        ContentUrl: l.contenturl || l.ContentUrl,
        ContentHtml: l.contenthtml || l.ContentHtml,
        Describe: l.describe || l.Describe || '',
        Summary: l.summary || l.Summary || '',
        Duration: l.duration || l.Duration,
        OrderIndex: l.orderindex || l.OrderIndex,
        quizCount: parseInt(l.quizcount || l.quizCount || 0)
      })));
    } catch (error) {
      console.error('getLessonsByModule:', error);
      res.status(500).json({ error: error.message });
    }
  },

  updateLesson: async (req, res) => {
    try {
      const { id } = req.params;
      const { Title, Type, ContentUrl, ContentHtml, Duration, OrderIndex, Describe, Summary } = req.body;
      
      if (!Title || !Type) {
        return res.status(400).json({ error: 'Title and Type required' });
      }
      
      if (!['video', 'reading', 'quiz'].includes(Type)) {
        return res.status(400).json({ error: 'Invalid lesson type' });
      }
      
      // Check exists
      const exists = await pool.query(
        'SELECT LessonID FROM Lessons WHERE LessonID = $1',
        [parseInt(id)]
      );
      if (!exists.rows.length) {
        return res.status(404).json({ error: 'Lesson not found' });
      }
      
      await pool.query(
        `UPDATE Lessons 
         SET Title = $2, Type = $3, ContentUrl = $4, ContentHtml = $5, 
             Duration = $6, OrderIndex = $7, "describe" = $8, "summary" = $9
         WHERE LessonID = $1`,
        [
          parseInt(id),
          Title,
          Type,
          ContentUrl || '',
          ContentHtml || '',
          parseInt(Duration || 0),
          parseInt(OrderIndex || 0),
          Describe || '',
          Summary || ''
        ]
      );
      
      res.json({ success: true, message: 'Lesson updated' });
    } catch (error) {
      console.error('updateLesson:', error);
      res.status(500).json({ error: error.message });
    }
  },

  getLessonById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await pool.query(
        'SELECT * FROM Lessons WHERE LessonID = $1',
        [parseInt(id)]
      );
      
      if (!result.rows.length) {
        return res.status(404).json({ error: 'Lesson not found' });
      }
      
      const l = result.rows[0];
      res.json({
        ...l,
        LessonID: l.lessonid || l.LessonID,
        ModuleID: l.moduleid || l.ModuleID,
        Title: l.title || l.Title,
        Type: l.type || l.Type,
        ContentUrl: l.contenturl || l.ContentUrl,
        ContentHtml: l.contenthtml || l.ContentHtml,
        Describe: l.describe || l.Describe || '',
        Summary: l.summary || l.Summary || '',
        Duration: l.duration || l.Duration,
        OrderIndex: l.orderindex || l.OrderIndex
      });
    } catch (error) {
      console.error('getLessonById:', error);
      res.status(500).json({ error: error.message });
    }
  },

  deleteLesson: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Manually cascade delete: Answers -> Questions -> Quizzes
      await pool.query(
        `DELETE FROM Answers 
         WHERE QuestionID IN (
             SELECT QuestionID FROM Questions 
             WHERE QuizID IN (SELECT QuizID FROM Quizzes WHERE LessonID = $1)
         )`,
        [parseInt(id)]
      );

      await pool.query(
        `DELETE FROM Questions 
         WHERE QuizID IN (SELECT QuizID FROM Quizzes WHERE LessonID = $1)`,
        [parseInt(id)]
      );

      await pool.query(
        `DELETE FROM Quizzes WHERE LessonID = $1`,
        [parseInt(id)]
      );
      
      await pool.query(
        'DELETE FROM Lessons WHERE LessonID = $1',
        [parseInt(id)]
      );
      
      res.json({ success: true, message: 'Lesson deleted' });
    } catch (error) {
      console.error('deleteLesson:', error);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = LessonController;
