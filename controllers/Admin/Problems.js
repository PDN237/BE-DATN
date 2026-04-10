const pool = require('../../db.js');

const ProblemsController = {
  // Get all problems for admin table (with counts)
  getAllProblems: async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const size = Math.max(1, Math.min(50, parseInt(req.query.size) || 10));
      const search = (req.query.search || '').trim();
      const offset = (page - 1) * size;

      const searchParam = `%${search}%`;
      const useSearch = search.length > 0;

      const mainParams = [offset, size]; // $1 = offset, $2 = size
      let mainQuery = `SELECT 
        p.id, p.title, p.difficulty, p.time_limit, 
        COUNT(tc.id) as testcase_count,
        COUNT(s.id) as submission_count
        FROM Problems p
        LEFT JOIN TestCases tc ON p.id = tc.problem_id
        LEFT JOIN Submissions s ON p.id = s.problem_id
        WHERE 1=1`;
      let mainWhereClause = '';
      if (useSearch) {
        mainWhereClause = ' AND p.title ILIKE $3'; // ILIKE is better for PG
        mainParams.push(searchParam);
      }
      mainQuery += mainWhereClause + `
        GROUP BY p.id, p.title, p.difficulty, p.time_limit
        ORDER BY p.id DESC
        LIMIT $2 OFFSET $1`;

      const problemsResult = await pool.query(mainQuery, mainParams);

      let countResult;
      if (useSearch) {
        countResult = await pool.query(
          `SELECT COUNT(DISTINCT p.id) as total 
           FROM Problems p 
           WHERE p.title ILIKE $1`,
          [searchParam]
        );
      } else {
        countResult = await pool.query(
          `SELECT COUNT(*) as total FROM Problems`
        );
      }

      const problems = problemsResult.rows || [];
      const total = parseInt(countResult.rows[0]?.total || 0);

      res.json({
        problems: problems.map(p => ({
          ...p,
          testcase_count: parseInt(p.testcase_count),
          submission_count: parseInt(p.submission_count)
        })),
        pagination: { page, size, total, totalPages: Math.ceil(total / size) }
      });
    } catch (error) {
      console.error('getAllProblems ERROR:', error);
      res.status(500).json({ error: error.message });
    }
  },

  getProblemById: async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await pool.query(
        `SELECT * FROM Problems WHERE id = $1`,
        [id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Problem not found' });
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createProblem: async (req, res) => {
    try {
      const { title, description, difficulty, time_limit, hints, examples } = req.body;
      if (!title || !description) {
        return res.status(400).json({ error: 'Title and description required' });
      }

      const result = await pool.query(
        `INSERT INTO Problems (title, description, difficulty, time_limit, hints, examples)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          title,
          description,
          difficulty,
          parseInt(time_limit),
          hints || '',
          examples || ''
        ]
      );

      res.status(201).json({ success: true, problem: result.rows[0] });
    } catch (error) {
      console.error('createProblem:', error);
      res.status(500).json({ error: error.message });
    }
  },

  updateProblem: async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { title, description, difficulty, time_limit, hints, examples } = req.body;

      // Check testcase requirements
      const tcCheck = await pool.query(
        `SELECT COUNT(*) as total, SUM(CASE WHEN is_hidden = false THEN 1 ELSE 0 END) as public_count
         FROM TestCases WHERE problem_id = $1`,
        [id]
      );
      const tc = tcCheck.rows[0];
      if (parseInt(tc.total || 0) < 2) {
        return res.status(400).json({ error: 'Problem must have at least 2 test cases' });
      }
      if (parseInt(tc.public_count || 0) < 1) {
        return res.status(400).json({ error: 'Problem must have at least 1 public test case (is_hidden = false)' });
      }

      await pool.query(
        `UPDATE Problems 
         SET title = $2, description = $3, difficulty = $4, 
             time_limit = $5, hints = $6, examples = $7
         WHERE id = $1`,
        [
          id,
          title,
          description,
          difficulty,
          parseInt(time_limit),
          hints || '',
          examples || ''
        ]
      );

      res.json({ success: true, message: 'Problem updated' });
    } catch (error) {
      console.error('updateProblem:', error);
      res.status(500).json({ error: error.message });
    }
  },

  deleteProblem: async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Check submissions
      const subCheck = await pool.query(
        `SELECT COUNT(*) as count FROM Submissions WHERE problem_id = $1`,
        [id]
      );
      if (parseInt(subCheck.rows[0].count) > 0) {
        return res.status(400).json({ error: 'Cannot delete problem with submissions' });
      }

      // Delete testcases first
      await pool.query(`DELETE FROM TestCases WHERE problem_id = $1`, [id]);
      // Delete problem
      await pool.query(`DELETE FROM Problems WHERE id = $1`, [id]);

      res.json({ success: true, message: 'Problem deleted' });
    } catch (error) {
      console.error('deleteProblem:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Test Cases
  getTestCases: async (req, res) => {
    try {
      const problemId = parseInt(req.params.problemId);
      const result = await pool.query(
        `SELECT id, input_data, expected_output, time_limit, is_hidden 
         FROM TestCases WHERE problem_id = $1 ORDER BY id`,
        [problemId]
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createTestCase: async (req, res) => {
    try {
      const problemId = parseInt(req.params.problemId);
      const { input_data, expected_output, time_limit, is_hidden } = req.body;

      const result = await pool.query(
        `INSERT INTO TestCases (problem_id, input_data, expected_output, time_limit, is_hidden)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          problemId,
          input_data,
          expected_output,
          parseInt(time_limit),
          is_hidden ? true : false
        ]
      );

      res.status(201).json({ success: true, testcase: result.rows[0] });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateTestCase: async (req, res) => {
    try {
      const problemId = parseInt(req.params.problemId);
      const tcid = parseInt(req.params.tcid);
      const { input_data, expected_output, time_limit, is_hidden } = req.body;

      await pool.query(
        `UPDATE TestCases SET input_data = $2, expected_output = $3, 
         time_limit = $4, is_hidden = $5 WHERE id = $1 AND problem_id = $6`,
        [
          tcid,
          input_data,
          expected_output,
          parseInt(time_limit),
          is_hidden ? true : false,
          problemId
        ]
      );

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteTestCase: async (req, res) => {
    try {
      const problemId = parseInt(req.params.problemId);
      const tcid = parseInt(req.params.tcid);

      // Check if the test case has been used in submissions
      const resultCheck = await pool.query(
        `SELECT COUNT(*) as count FROM Results WHERE testcase_id = $1`,
        [tcid]
      );
      
      if (parseInt(resultCheck.rows[0].count) > 0) {
        return res.status(400).json({ error: 'Cannot delete test case that has been used in submissions' });
      }

      await pool.query(
        `DELETE FROM TestCases WHERE id = $1 AND problem_id = $2`,
        [
          tcid,
          problemId
        ]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  duplicateTestCase: async (req, res) => {
    try {
      const problemId = parseInt(req.params.problemId);
      const tcid = parseInt(req.params.tcid);
      const original = await pool.query(
        `SELECT input_data, expected_output, time_limit, is_hidden FROM TestCases WHERE id = $1`,
        [tcid]
      );
      if (original.rows.length === 0) return res.status(404).json({ error: 'Test case not found' });

      // PG supports RETURNING but requires values
      const newTc = await pool.query(
        `INSERT INTO TestCases (problem_id, input_data, expected_output, time_limit, is_hidden)
         SELECT $1, input_data, expected_output, time_limit, is_hidden FROM TestCases WHERE id = $2
         RETURNING *`,
        [
          problemId,
          tcid
        ]
      );
      res.json({ success: true, testcase: newTc.rows[0] });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = ProblemsController;
