const pool = require('../../db.js');

const DashboardController = {
  getStats: async (req, res) => {
    try {
      const [
        courses,
        users,
        problems,
        submissions,
        enrollments,
        recentUsers,
        recentSubmissions,
        topCourses,
        problemDifficulty,
        submissionStats
      ] = await Promise.all([
        pool.query('SELECT COUNT(*) as count FROM Courses'),
        pool.query('SELECT COUNT(*) as count FROM Users WHERE RoleID != 1'),
        pool.query('SELECT COUNT(*) as count FROM Problems'),
        pool.query('SELECT COUNT(*) as count FROM Submissions'),
        pool.query('SELECT COUNT(*) as count FROM Enrollments'),
        // Top 5 recent users
        pool.query(`
          SELECT UserID, FullName, Email, CreatedAt 
          FROM Users 
          WHERE RoleID != 1
          ORDER BY CreatedAt DESC
          LIMIT 5
        `),
        // Top 5 recent submissions
        pool.query(`
          SELECT s.id, s.status, s.created_at, u.FullName, u.Email, p.title as ProblemTitle
          FROM Submissions s
          LEFT JOIN Users u ON s.userId = u.UserID
          LEFT JOIN Problems p ON s.problem_id = p.id
          ORDER BY s.created_at DESC
          LIMIT 5
        `),
        // Top courses by enrollment
        pool.query(`
          SELECT c.CourseID, c.Title, c.Level, c.Thumbnail,
                 COUNT(DISTINCT e.UserID) as EnrollmentCount
          FROM Courses c
          LEFT JOIN Enrollments e ON c.CourseID = e.CourseID
          GROUP BY c.CourseID, c.Title, c.Level, c.Thumbnail
          ORDER BY EnrollmentCount DESC
          LIMIT 5
        `),
        // Problem difficulty distribution
        pool.query(`
          SELECT Difficulty, COUNT(*) as count
          FROM Problems
          GROUP BY Difficulty
          ORDER BY Difficulty
        `),
        // Submission statistics by status
        pool.query(`
          SELECT status, COUNT(*) as count
          FROM Submissions
          GROUP BY status
        `)
      ]);
      
      // Calculate acceptance rate
      const totalSubs = parseInt(submissions.rows[0].count || 0);
      const acceptedSubs = submissionStats.rows.find(r => r.status === 'Accepted')?.count || 0;
      const acceptanceRate = totalSubs > 0 ? ((acceptedSubs / totalSubs) * 100).toFixed(1) : 0;

      res.json({
        stats: {
          totalCourses: parseInt(courses.rows[0].count || 0),
          totalUsers: parseInt(users.rows[0].count || 0),
          totalProblems: parseInt(problems.rows[0].count || 0),
          totalSubmissions: parseInt(submissions.rows[0].count || 0),
          totalEnrollments: parseInt(enrollments.rows[0].count || 0),
          activeUsers: 0,
          completionRate: 0,
          acceptanceRate: parseFloat(acceptanceRate)
        },
        recentUsers: recentUsers.rows.map(r => ({
          UserID: r.UserID,
          FullName: r.FullName,
          Email: r.Email,
          CreatedAt: r.CreatedAt
        })),
        recentSubmissions: recentSubmissions.rows.map(r => ({
          id: r.id,
          status: r.status,
          created_at: r.created_at,
          FullName: r.FullName,
          Email: r.Email,
          ProblemTitle: r.ProblemTitle
        })),
        courseCompletions: [],
        problemDifficulty: problemDifficulty.rows.map(r => ({
          difficulty: r.Difficulty || 'Unknown',
          count: parseInt(r.count || 0)
        })),
        topCourses: topCourses.rows.map(r => ({
          courseId: r.CourseID,
          title: r.Title,
          level: r.Level,
          thumbnail: r.Thumbnail,
          enrollmentCount: parseInt(r.EnrollmentCount || 0)
        })),
        submissionStats: submissionStats.rows.map(r => ({
          status: r.status,
          count: parseInt(r.count || 0)
        }))
      });
    } catch (error) {
      console.error('Dashboard stats error:', error.message);
      console.error('Error details:', error);
      res.status(500).json({ error: 'Stats error', message: error.message });
    }
  }
};

module.exports = DashboardController;
