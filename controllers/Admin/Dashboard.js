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
        recentSubmissions
      ] = await Promise.all([
        pool.query('SELECT COUNT(*) as count FROM Courses'),
        pool.query('SELECT COUNT(*) as count FROM USERS WHERE RoleID != 1'),
        pool.query('SELECT COUNT(*) as count FROM Problems'),
        pool.query('SELECT COUNT(*) as count FROM Submissions'),
        pool.query(`
          SELECT UserID, FullName, Email, CreatedAt 
          FROM USERS 
          WHERE RoleID != 1
          ORDER BY CreatedAt DESC
          LIMIT 5
        `),
        pool.query(`
          SELECT s.id, s.status, s.created_at, 
                 COALESCE(u.FullName, 'Unknown User') as FullName, 
                 COALESCE(u.Email, 'N/A') as Email, 
                 p.title as ProblemTitle
          FROM Submissions s
          LEFT JOIN USERS u ON s.userId = u.UserID
          LEFT JOIN Problems p ON s.problem_id = p.id
          ORDER BY s.created_at DESC
          LIMIT 5
        `)
      ]);

      // Additional stats with error handling
      let activeUsers7Days = { rows: [{ count: 0 }] };
      let activeUsers30Days = { rows: [{ count: 0 }] };
      let problemDifficulty = { rows: [] };
      let topCourses = { rows: [] };
      let submissionSuccessRate = { rows: [{ accepted: 0, total: 0 }] };
      let courseLevelDistribution = { rows: [] };

      try {
        activeUsers7Days = await pool.query(`
          SELECT COUNT(DISTINCT userId) as count
          FROM Submissions
          WHERE id IN (
            SELECT id FROM Submissions 
            ORDER BY id DESC 
            LIMIT 1000
          )
        `);
      } catch (e) { console.error('activeUsers7Days error:', e); }

      try {
        activeUsers30Days = await pool.query(`
          SELECT COUNT(DISTINCT userId) as count
          FROM Submissions
        `);
      } catch (e) { console.error('activeUsers30Days error:', e); }

      try {
        problemDifficulty = await pool.query(`
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
        `);
      } catch (e) { console.error('problemDifficulty error:', e); }

      try {
        courseLevelDistribution = await pool.query(`
          SELECT 
            CASE 
              WHEN Level = 'Beginner' THEN 'Cơ bản'
              WHEN Level = 'Intermediate' THEN 'Trung cấp'
              WHEN Level = 'Advanced' THEN 'Nâng cao'
              ELSE 'Khác'
            END as level,
            COUNT(*) as count
          FROM Courses
          WHERE Level IS NOT NULL
          GROUP BY level
        `);
      } catch (e) { console.error('courseLevelDistribution error:', e); }

      try {
        topCourses = await pool.query(`
          SELECT 
            c.CourseID,
            c.Title,
            COUNT(DISTINCT up.UserID) as enrollmentCount
          FROM Courses c
          LEFT JOIN Modules m ON c.CourseID = m.CourseID
          LEFT JOIN Lessons l ON m.ModuleID = l.ModuleID
          LEFT JOIN UserProgress up ON l.LessonID = up.LessonID
          GROUP BY c.CourseID, c.Title
          ORDER BY enrollmentCount DESC
          LIMIT 5
        `);
      } catch (e) { 
        console.error('topCourses error:', e);
        // Fallback: just show courses with 0 enrollments
        topCourses = await pool.query(`
          SELECT 
            CourseID,
            Title,
            0 as enrollmentCount
          FROM Courses
          ORDER BY CourseID
          LIMIT 5
        `);
      }

      try {
        submissionSuccessRate = await pool.query(`
          SELECT 
            COUNT(*) FILTER (WHERE status = 'Accepted') as accepted,
            COUNT(*) as total
          FROM Submissions
        `);
      } catch (e) { 
        console.error('submissionSuccessRate error:', e);
        // Fallback query without FILTER
        try {
          const accepted = await pool.query(`SELECT COUNT(*) as count FROM Submissions WHERE status = 'Accepted'`);
          const total = await pool.query(`SELECT COUNT(*) as count FROM Submissions`);
          submissionSuccessRate = { 
            rows: [{ 
              accepted: accepted.rows[0].count, 
              total: total.rows[0].count 
            }] 
          };
        } catch (e2) { console.error('fallback error:', e2); }
      }
      
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
        courseLevelDistribution: courseLevelDistribution.rows.map(r => ({
          level: r.level,
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
