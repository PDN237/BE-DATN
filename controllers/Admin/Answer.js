const pool = require('../../db.js');

const AnswerController = {
  createAnswer: async (req, res) => {
    try {
      const { QuestionID, AnswerText, IsCorrect } = req.body;
      
      if (!QuestionID || !AnswerText) {
        return res.status(400).json({ error: 'QuestionID and AnswerText required' });
      }
      
      const result = await pool.query(
        `INSERT INTO Answers (QuestionID, AnswerText, IsCorrect)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [
          parseInt(QuestionID),
          AnswerText,
          IsCorrect || false
        ]
      );
      
      res.status(201).json({
        success: true,
        answer: result.rows[0],
        message: 'Answer created successfully'
      });
    } catch (error) {
      console.error('createAnswer:', error);
      res.status(500).json({ error: error.message });
    }
  },

  getAnswersByQuestion: async (req, res) => {
    try {
      const { questionId } = req.params;
      
      const result = await pool.query(
        `SELECT * FROM Answers 
         WHERE QuestionID = $1
         ORDER BY AnswerID`,
        [parseInt(questionId)]
      );
      
      res.json(result.rows);
    } catch (error) {
      console.error('getAnswersByQuestion:', error);
      res.status(500).json({ error: error.message });
    }
  },

  updateAnswer: async (req, res) => {
    try {
      const { id } = req.params;
      const { AnswerText, IsCorrect } = req.body;
      
      if (!AnswerText) {
        return res.status(400).json({ error: 'AnswerText required' });
      }
      
      const exists = await pool.query(
        'SELECT AnswerID FROM Answers WHERE AnswerID = $1',
        [parseInt(id)]
      );
      if (!exists.rows.length) {
        return res.status(404).json({ error: 'Answer not found' });
      }
      
      // Ensure exactly one correct answer per question
      if (IsCorrect) {
        await pool.query(
          'UPDATE Answers SET IsCorrect = false WHERE QuestionID = (SELECT QuestionID FROM Answers WHERE AnswerID = $1) AND AnswerID != $2',
          [
            parseInt(id),
            parseInt(id)
          ]
        );
      }
      
      await pool.query(
        `UPDATE Answers 
         SET AnswerText = $2, IsCorrect = $3
         WHERE AnswerID = $1`,
        [
          parseInt(id),
          AnswerText,
          IsCorrect || false
        ]
      );
      
      res.json({ success: true, message: 'Answer updated' });
    } catch (error) {
      console.error('updateAnswer:', error);
      res.status(500).json({ error: error.message });
    }
  },

  deleteAnswer: async (req, res) => {
    try {
      const { id } = req.params;
      
      await pool.query(
        'DELETE FROM Answers WHERE AnswerID = $1',
        [parseInt(id)]
      );
      
      res.json({ success: true, message: 'Answer deleted' });
    } catch (error) {
      console.error('deleteAnswer:', error);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = AnswerController;
