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
        p.id, p.title, p.difficulty, p.time_limit, p.accept,
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
        GROUP BY p.id, p.title, p.difficulty, p.time_limit, p.accept
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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { title, description, difficulty, time_limit, hints, examples, accept } = req.body;

      // Enhanced validation
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Title is required and must be a non-empty string' });
      }

      if (!description || typeof description !== 'string' || description.trim().length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Description is required and must be a non-empty string' });
      }

      if (title.length > 255) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Title must not exceed 255 characters' });
      }

      // Validate difficulty
      const validDifficulties = ['Easy', 'Medium', 'Hard'];
      if (difficulty && !validDifficulties.includes(difficulty)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Difficulty must be one of: Easy, Medium, Hard' });
      }

      // Validate time_limit
      const timeLimitNum = parseInt(time_limit);
      if (isNaN(timeLimitNum) || timeLimitNum < 100 || timeLimitNum > 10000) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Time limit must be between 100 and 10000 milliseconds' });
      }

      // Check for duplicate title
      const duplicateCheck = await client.query(
        `SELECT id FROM Problems WHERE title ILIKE $1`,
        [title.trim()]
      );

      if (duplicateCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'A problem with this title already exists' });
      }

      let result;
      try {
        result = await client.query(
          `INSERT INTO Problems (title, description, difficulty, time_limit, hints, examples, accept)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            title.trim(),
            description.trim(),
            difficulty || 'Medium',
            timeLimitNum,
            hints || '',
            examples || '',
            accept !== undefined ? accept : true
          ]
        );
      } catch (insertError) {
        console.log('INSERT ERROR DETAILS:', {
          code: insertError.code,
          constraint: insertError.constraint,
          message: insertError.message
        });
        
        // Handle duplicate key violation (sequence sync issue)
        if (insertError.code === '23505' && (insertError.constraint === 'problems_pkey' || insertError.message.includes('problems_pkey'))) {
          console.log('Attempting to reset sequence...');
          // Reset the sequence to the max existing id
          await client.query(
            `SELECT setval(
              pg_get_serial_sequence('Problems', 'id'),
              COALESCE(MAX(id), 1),
              true
            ) FROM Problems`
          );
          console.log('Sequence reset, retrying insert...');
          
          // Retry the insert
          result = await client.query(
            `INSERT INTO Problems (title, description, difficulty, time_limit, hints, examples, accept)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
              title.trim(),
              description.trim(),
              difficulty || 'Medium',
              timeLimitNum,
              hints || '',
              examples || '',
              accept !== undefined ? accept : true
            ]
          );
          console.log('Insert retry successful');
        } else {
          console.log('Error not handled by sequence fix, rethrowing...');
          throw insertError;
        }
      }

      await client.query('COMMIT');
      res.status(201).json({ 
        success: true, 
        problem: result.rows[0],
        message: 'Problem created successfully. Add at least 2 test cases (1 public) to make it available for users.'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('createProblem ERROR:', error);
      res.status(500).json({ error: 'Failed to create problem: ' + error.message });
    } finally {
      client.release();
    }
  },

  updateProblem: async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const id = parseInt(req.params.id);
      const { title, description, difficulty, time_limit, hints, examples, accept } = req.body;

      // Check if problem exists
      const problemCheck = await client.query(
        `SELECT id FROM Problems WHERE id = $1`,
        [id]
      );

      if (problemCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Problem not found' });
      }

      // Enhanced validation
      if (title !== undefined) {
        if (typeof title !== 'string' || title.trim().length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Title must be a non-empty string' });
        }
        if (title.length > 255) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Title must not exceed 255 characters' });
        }
      }

      if (description !== undefined) {
        if (typeof description !== 'string' || description.trim().length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Description must be a non-empty string' });
        }
      }

      // Validate difficulty if provided
      if (difficulty !== undefined) {
        const validDifficulties = ['Easy', 'Medium', 'Hard'];
        if (!validDifficulties.includes(difficulty)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Difficulty must be one of: Easy, Medium, Hard' });
        }
      }

      // Validate time_limit if provided
      if (time_limit !== undefined) {
        const timeLimitNum = parseInt(time_limit);
        if (isNaN(timeLimitNum) || timeLimitNum < 100 || timeLimitNum > 10000) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Time limit must be between 100 and 10000 milliseconds' });
        }
      }

      // Check for duplicate title if title is being changed
      if (title !== undefined) {
        const duplicateCheck = await client.query(
          `SELECT id FROM Problems WHERE title ILIKE $1 AND id != $2`,
          [title.trim(), id]
        );

        if (duplicateCheck.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'A problem with this title already exists' });
        }
      }

      // Check testcase status (warning only, not blocking)
      const tcCheck = await client.query(
        `SELECT COUNT(*) as total, SUM(CASE WHEN is_hidden = false THEN 1 ELSE 0 END) as public_count
         FROM TestCases WHERE problem_id = $1`,
        [id]
      );
      const tc = tcCheck.rows[0];
      const totalTC = parseInt(tc.total || 0);
      const publicTC = parseInt(tc.public_count || 0);

      // Build dynamic update query
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        values.push(title.trim());
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description.trim());
      }
      if (difficulty !== undefined) {
        updates.push(`difficulty = $${paramIndex++}`);
        values.push(difficulty);
      }
      if (time_limit !== undefined) {
        updates.push(`time_limit = $${paramIndex++}`);
        values.push(parseInt(time_limit));
      }
      if (hints !== undefined) {
        updates.push(`hints = $${paramIndex++}`);
        values.push(hints || '');
      }
      if (examples !== undefined) {
        updates.push(`examples = $${paramIndex++}`);
        values.push(examples || '');
      }
      if (accept !== undefined) {
        updates.push(`accept = $${paramIndex++}`);
        values.push(accept);
      }

      if (updates.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(id);
      const query = `UPDATE Problems SET ${updates.join(', ')} WHERE id = $${paramIndex}`;

      await client.query(query, values);
      await client.query('COMMIT');

      const response = { 
        success: true, 
        message: 'Problem updated successfully'
      };

      // Add warning if test cases are insufficient
      if (totalTC < 2 || publicTC < 1) {
        response.warning = 'Problem has insufficient test cases. Add at least 2 test cases (1 public) to make it available for users.';
        response.testcaseStatus = { total: totalTC, public: publicTC };
      }

      res.json(response);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('updateProblem ERROR:', error);
      res.status(500).json({ error: 'Failed to update problem: ' + error.message });
    } finally {
      client.release();
    }
  },

  deleteProblem: async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const id = parseInt(req.params.id);

      // Check if problem exists
      const problemCheck = await client.query(
        `SELECT id, title FROM Problems WHERE id = $1`,
        [id]
      );

      if (problemCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Problem not found' });
      }

      const problemTitle = problemCheck.rows[0].title;

      // Check submissions and test cases count for info
      const [subCheck, tcCheck] = await Promise.all([
        client.query(`SELECT COUNT(*) as count FROM Submissions WHERE problem_id = $1`, [id]),
        client.query(`SELECT COUNT(*) as count FROM TestCases WHERE problem_id = $1`, [id])
      ]);
      const submissionCount = parseInt(subCheck.rows[0].count || 0);
      const testcaseCount = parseInt(tcCheck.rows[0].count || 0);

      // Cascade delete in proper order:
      // 1. Delete Results (via submissions)
      await client.query(
        `DELETE FROM Results r
         USING Submissions s
         WHERE r.submission_id = s.id AND s.problem_id = $1`,
        [id]
      );

      // 2. Delete Results (via testcases - backup)
      await client.query(
        `DELETE FROM Results r
         USING TestCases tc
         WHERE r.testcase_id = tc.id AND tc.problem_id = $1`,
        [id]
      );

      // 3. Delete Submissions
      await client.query(`DELETE FROM Submissions WHERE problem_id = $1`, [id]);

      // 4. Delete TestCases
      await client.query(`DELETE FROM TestCases WHERE problem_id = $1`, [id]);

      // 5. Delete Problem
      const deleteResult = await client.query(`DELETE FROM Problems WHERE id = $1 RETURNING id`, [id]);

      if (deleteResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Problem not found' });
      }

      await client.query('COMMIT');

      res.json({ 
        success: true, 
        message: `Problem "${problemTitle}" deleted successfully`,
        deleted: {
          problemId: id,
          problemTitle: problemTitle,
          testcasesDeleted: testcaseCount,
          submissionsDeleted: submissionCount
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('deleteProblem ERROR:', error);
      res.status(500).json({ error: 'Failed to delete problem: ' + error.message });
    } finally {
      client.release();
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
