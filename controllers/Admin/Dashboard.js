const pool = require('../../db.js');

const DashboardController = {
  getStats: async (req, res) => {
    try {
      const [
        courses,
        users,
        problems,
        submissions,
        recentUsers,
        recentSubmissions,
        activeUsers7Days,
        activeUsers30Days,
        monthlyGrowth,
        problemDifficulty,
        topCourses,
        submissionSuccessRate
      ] = await Promise.all([
        pool.query('SELECT COUNT(*) as count FROM Courses'),
        pool.query('SELECT COUNT(*) as count FROM Users WHERE RoleID != 1'),
        pool.query('SELECT COUNT(*) as count FROM Problems'),
        pool.query('SELECT COUNT(*) as count FROM Submissions'),
        pool.query(`
          SELECT UserID, FullName, Email, CreatedAt 
          FROM Users 
          WHERE RoleID != 1
          ORDER BY CreatedAt DESC
          LIMIT 5
        `),
        pool.query(`
          SELECT s.id, s.status, s.created_at, u.FullName, u.Email, p.title as ProblemTitle
          FROM Submissions s
          LEFT JOIN Users u ON s.userId = u.UserID
          LEFT JOIN Problems p ON s.problem_id = p.id
          ORDER BY s.created_at DESC
          LIMIT 5
        `),
        pool.query(`
          SELECT COUNT(DISTINCT userId) as count
          FROM Submissions
          WHERE created_at >= NOW() - INTERVAL '7 days'
        `),
        pool.query(`
          SELECT COUNT(DISTINCT userId) as count
          FROM Submissions
          WHERE created_at >= NOW() - INTERVAL '30 days'
        `),
        pool.query(`
          SELECT 
            DATE_TRUNC('month', CreatedAt) as month,
            COUNT(*) as count
          FROM Users
          WHERE RoleID != 1
            AND CreatedAt >= NOW() - INTERVAL '6 months'
          GROUP BY DATE_TRUNC('month', CreatedAt)
          ORDER BY month ASC
        `),
        pool.query(`
          SELECT 
            CASE 
              WHEN difficulty = 'Easy' THEN 'Easy'
              WHEN difficulty = 'Medium' THEN 'Medium'
              WHEN difficulty = 'Hard' THEN 'Hard'
              ELSE 'Unknown'
            END as difficulty,
            COUNT(*) as count
          FROM Problems
          GROUP BY difficulty
        `),
        pool.query(`
          SELECT 
            c.CourseID,
            c.Title,
            COUNT(DISTINCT ce.UserID) as enrollmentCount
          FROM Courses c
          LEFT JOIN CourseEnrollments ce ON c.CourseID = ce.CourseID
          GROUP BY c.CourseID, c.Title
          ORDER BY enrollmentCount DESC
          LIMIT 5
        `),
        pool.query(`
          SELECT 
            COUNT(*) FILTER (WHERE status = 'Accepted') as accepted,
            COUNT(*) as total
          FROM Submissions
        `)
      ]);
      
      const successRate = submissionSuccessRate.rows[0].total > 0 
        ? ((submissionSuccessRate.rows[0].accepted / submissionSuccessRate.rows[0].total) * 100).toFixed(1)
        : 0;

      res.json({
        stats: {
          totalCourses: parseInt(courses.rows[0].count || 0),
          totalUsers: parseInt(users.rows[0].count || 0),
          totalProblems: parseInt(problems.rows[0].count || 0),
          totalSubmissions: parseInt(submissions.rows[0].count || 0),
          activeUsers7Days: parseInt(activeUsers7Days.rows[0].count || 0),
          activeUsers30Days: parseInt(activeUsers30Days.rows[0].count || 0),
          submissionSuccessRate: parseFloat(successRate)
        },
        recentUsers: recentUsers.rows.map(r => ({
          ...r,
          UserID: r.userid || r.UserID,
          FullName: r.fullname || r.FullName,
          Email: r.email || r.Email,
          CreatedAt: r.createdat || r.CreatedAt
        })),
        recentSubmissions: recentSubmissions.rows.map(r => ({
          ...r,
          id: r.id,
          status: r.status,
          created_at: r.created_at,
          FullName: r.fullname || r.FullName,
          Email: r.email || r.Email,
          ProblemTitle: r.problemtitle || r.ProblemTitle
        })),
        monthlyGrowth: monthlyGrowth.rows.map(r => ({
          month: r.month,
          count: parseInt(r.count)
        })),
        problemDifficulty: problemDifficulty.rows.map(r => ({
          difficulty: r.difficulty,
          count: parseInt(r.count)
        })),
        topCourses: topCourses.rows.map(r => ({
          CourseID: r.courseid || r.CourseID,
          Title: r.title || r.Title,
          enrollmentCount: parseInt(r.enrollmentcount || 0)
        }))
      });
    } catch (error) {
      console.error('Dashboard stats:', error);
      res.status(500).json({ error: 'Stats error' });
    }
  }
};

module.exports = DashboardController;
