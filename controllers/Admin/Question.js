const pool = require('../../db.js');

const QuestionController = {
  createQuestion: async (req, res) => {
    try {
      const { QuizID, QuestionText, Explanation } = req.body;
      
      if (!QuizID || !QuestionText) {
        return res.status(400).json({ error: 'QuizID and QuestionText required' });
      }
      
      const result = await pool.query(
        `INSERT INTO Questions (QuizID, QuestionText, Explanation)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [
          parseInt(QuizID),
          QuestionText,
          Explanation || ''
        ]
      );
      
      res.status(201).json({
        success: true,
        question: result.rows[0],
        message: 'Question created successfully'
      });
    } catch (error) {
      console.error('createQuestion:', error);
      res.status(500).json({ error: error.message });
    }
  },

  getQuestionsByQuiz: async (req, res) => {
    try {
      const { quizId } = req.params;
      
      const result = await pool.query(
        `SELECT qst.*,
          COUNT(a.AnswerID) as answercount
         FROM Questions qst
         LEFT JOIN Answers a ON qst.QuestionID = a.QuestionID
         WHERE qst.QuizID = $1
         GROUP BY qst.QuestionID, qst.QuizID, qst.QuestionText, qst.Explanation
         ORDER BY qst.QuestionID`,
        [parseInt(quizId)]
      );
      
      const questions = result.rows.map(q => ({
        ...q,
        answerCount: parseInt(q.answercount)
      }));
      res.json(questions);
    } catch (error) {
      console.error('getQuestionsByQuiz:', error);
      res.status(500).json({ error: error.message });
    }
  },

  updateQuestion: async (req, res) => {
    try {
      const { id } = req.params;
      const { QuestionText, Explanation } = req.body;
      
      if (!QuestionText) {
        return res.status(400).json({ error: 'QuestionText required' });
      }
      
      const exists = await pool.query(
        'SELECT QuestionID FROM Questions WHERE QuestionID = $1',
        [parseInt(id)]
      );
      if (!exists.rows.length) {
        return res.status(404).json({ error: 'Question not found' });
      }
      
      await pool.query(
        `UPDATE Questions 
         SET QuestionText = $2, Explanation = $3
         WHERE QuestionID = $1`,
        [
          parseInt(id),
          QuestionText,
          Explanation || ''
        ]
      );
      
      res.json({ success: true, message: 'Question updated' });
    } catch (error) {
      console.error('updateQuestion:', error);
      res.status(500).json({ error: error.message });
    }
  },

  deleteQuestion: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check answers
      const deps = await pool.query(
        `SELECT COUNT(a.AnswerID) as answercount 
         FROM Answers a 
         WHERE a.QuestionID = $1`,
        [parseInt(id)]
      );
      
      const count = parseInt(deps.rows[0].answercount);
      if (count > 0) {
        return res.status(400).json({
          error: 'Cannot delete question with answers',
          details: { answers: count }
        });
      }
      
      await pool.query(
        'DELETE FROM Questions WHERE QuestionID = $1',
        [parseInt(id)]
      );
      
      res.json({ success: true, message: 'Question deleted' });
    } catch (error) {
      console.error('deleteQuestion:', error);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = QuestionController;
