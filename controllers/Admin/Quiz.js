const pool = require('../../db.js');

const QuizController = {
  createQuiz: async (req, res) => {
    try {
      const { LessonID, Title } = req.body;
      
      if (!LessonID || !Title) {
        return res.status(400).json({ error: 'LessonID and Title required' });
      }
      
      const result = await pool.query(
        `INSERT INTO Quizzes (LessonID, Title)
         VALUES ($1, $2)
         RETURNING *`,
        [
          parseInt(LessonID),
          Title
        ]
      );
      
      res.status(201).json({
        success: true,
        quiz: result.rows[0],
        message: 'Quiz created successfully'
      });
    } catch (error) {
      console.error('createQuiz:', error);
      res.status(500).json({ error: error.message });
    }
  },

  getQuizzesByLesson: async (req, res) => {
    try {
      const { lessonId } = req.params;
      
      const result = await pool.query(
        `SELECT q.*, 
          COUNT(qu.QuestionID) as questioncount
         FROM Quizzes q 
         LEFT JOIN Questions qu ON q.QuizID = qu.QuizID
         WHERE q.LessonID = $1
         GROUP BY q.QuizID, q.LessonID, q.Title
         ORDER BY q.QuizID`,
        [parseInt(lessonId)]
      );
      
      const quizzes = result.rows.map(q => ({
        ...q,
        questionCount: parseInt(q.questioncount)
      }));
      res.json(quizzes);
    } catch (error) {
      console.error('getQuizzesByLesson:', error);
      res.status(500).json({ error: error.message });
    }
  },

  updateQuiz: async (req, res) => {
    try {
      const { id } = req.params;
      const { Title } = req.body;
      
      if (!Title) {
        return res.status(400).json({ error: 'Title required' });
      }
      
      const exists = await pool.query(
        'SELECT QuizID FROM Quizzes WHERE QuizID = $1',
        [parseInt(id)]
      );
      if (!exists.rows.length) {
        return res.status(404).json({ error: 'Quiz not found' });
      }
      
      await pool.query(
        `UPDATE Quizzes 
         SET Title = $2
         WHERE QuizID = $1`,
        [
          parseInt(id),
          Title
        ]
      );
      
      res.json({ success: true, message: 'Quiz updated' });
    } catch (error) {
      console.error('updateQuiz:', error);
      res.status(500).json({ error: error.message });
    }
  },

  deleteQuiz: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check questions
      const deps = await pool.query(
        `SELECT COUNT(qst.QuestionID) as questioncount 
         FROM Questions qst 
         WHERE qst.QuizID = $1`,
        [parseInt(id)]
      );
      
      const count = parseInt(deps.rows[0].questioncount);
      if (count > 0) {
        return res.status(400).json({
          error: 'Cannot delete quiz with questions',
          details: { questions: count }
        });
      }
      
      await pool.query(
        'DELETE FROM Quizzes WHERE QuizID = $1',
        [parseInt(id)]
      );
      
      res.json({ success: true, message: 'Quiz deleted' });
    } catch (error) {
      console.error('deleteQuiz:', error);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = QuizController;
