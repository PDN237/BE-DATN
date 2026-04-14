const ObjectPool = require('../db'); // Usually renamed to pool
const pool = ObjectPool;

const getAllProblems = async (req, res) => {
  try {
    const userId = parseInt(req.query.userId);
    let queryParams = [];
    
    let query = `
      SELECT
        id,
        title,
        difficulty,
        time_limit,
        accept,
        score`;
        
    if (userId) {
      queryParams.push(userId);
      query += `,
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM Submissions s 
                WHERE s.problem_id = Problems.id 
                  AND s.user_id = $1 
                  AND s.status = 'Accepted'
            ) THEN 'Solved'
            WHEN EXISTS (
                SELECT 1 FROM Submissions s 
                WHERE s.problem_id = Problems.id 
                  AND s.user_id = $1
            ) THEN 'Attempted'
            ELSE 'Not Started'
        END AS user_status`;
    } else {
      query += `, 'Not Started' AS user_status`;
    }
    
    query += ` FROM Problems ORDER BY id`;
    const result = await pool.query(query, queryParams);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching problems:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy dữ liệu problems',
      error: error.message
    });
  }
};

const getProblemById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = parseInt(req.query.userId);
    
    let query = `
      SELECT
        id,
        title,
        description,
        difficulty,
        time_limit,
        hints,
        examples,
        accept,
        score`;
        
    let queryParams = [id];
    
    if (userId) {
      queryParams.push(userId);
      query += `,
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM Submissions s 
                WHERE s.problem_id = Problems.id 
                  AND s.user_id = $2 
                  AND s.status = 'Accepted'
            ) THEN 'Solved'
            WHEN EXISTS (
                SELECT 1 FROM Submissions s 
                WHERE s.problem_id = Problems.id 
                  AND s.user_id = $2
            ) THEN 'Attempted'
            ELSE 'Not Started'
        END AS user_status`;
    } else {
      query += `, 'Not Started' AS user_status`;
    }
    
    query += ` FROM Problems WHERE id = $1`;
    const result = await pool.query(query, queryParams);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy problem'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching problem:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy dữ liệu problem',
      error: error.message
    });
  }
};

const getTestCasesByProblemId = async (req, res) => {
  try {
    const problemId = parseInt(req.params.problemId);
    
    const result = await pool.query(`
      SELECT 
        id,
        problem_id,
        input_data,
        expected_output,
        is_hidden
      FROM TestCases
      WHERE problem_id = $1
      ORDER BY id
    `, [problemId]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching test cases:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy dữ liệu test cases',
      error: error.message
    });
  }
};

module.exports = {
  getAllProblems,
  getProblemById,
  getTestCasesByProblemId
};
