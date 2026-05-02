const pool = require('../db');

const getInstructorById = async (req, res) => {
  try {
    const instructorId = parseInt(req.params.id);

    // Get instructor info
    const instructorQuery = `
      SELECT UserID, FullName, Email, AvatarUrl, Describe, Phone, Location, CreatedAt
      FROM USERS
      WHERE UserID = $1 AND RoleID = 4 AND IsActive = true
    `;
    const instructorResult = await pool.query(instructorQuery, [instructorId]);

    if (instructorResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy giảng viên'
      });
    }

    const instructor = instructorResult.rows[0];

    // Get instructor's published courses only (iscompleted=true AND accept=true)
    const coursesQuery = `
      SELECT CourseID, Title, Description, Level, Thumbnail, CreatedAt, iscompleted, accept
      FROM Courses
      WHERE UserID = $1 AND iscompleted = true AND accept = true
      ORDER BY CreatedAt DESC
    `;
    const coursesResult = await pool.query(coursesQuery, [instructorId]);

    // Count total courses (all published)
    const totalCourses = coursesResult.rows.length;
    const publishedCourses = coursesResult.rows.length;

    // Calculate total enrollments across all instructor's courses
    const enrollmentsQuery = `
      SELECT COUNT(*) as total_enrollments
      FROM Enrollments e
      JOIN Courses c ON e.CourseID = c.CourseID
      WHERE c.UserID = $1
    `;
    const enrollmentsResult = await pool.query(enrollmentsQuery, [instructorId]);
    const totalEnrollments = parseInt(enrollmentsResult.rows[0].total_enrollments || 0);

    // Calculate total ratings and average rating across all instructor's courses
    const ratingsQuery = `
      SELECT 
        COUNT(*) as total_ratings,
        COALESCE(AVG(rating), 0) as average_rating
      FROM Comments c
      JOIN Courses co ON c.courseid = co.CourseID
      WHERE co.UserID = $1 AND c.rating IS NOT NULL
    `;
    const ratingsResult = await pool.query(ratingsQuery, [instructorId]);
    const totalRatings = parseInt(ratingsResult.rows[0].total_ratings || 0);
    const averageRating = parseFloat(ratingsResult.rows[0].average_rating || 0).toFixed(1);

    res.json({
      success: true,
      data: {
        instructor: {
          UserID: instructor.userid || instructor.UserID,
          FullName: instructor.fullname || instructor.FullName,
          Email: instructor.email || instructor.Email,
          AvatarUrl: instructor.avatarurl || instructor.AvatarUrl,
          Describe: instructor.describe || instructor.Describe || '',
          Phone: instructor.phone || instructor.Phone,
          Location: instructor.location || instructor.Location,
          CreatedAt: instructor.createdat || instructor.CreatedAt
        },
        courses: coursesResult.rows.map(course => ({
          CourseID: course.courseid || course.CourseID,
          Title: course.title || course.Title,
          Description: course.description || course.Description,
          Level: course.level || course.Level,
          Thumbnail: course.thumbnail || course.Thumbnail,
          CreatedAt: course.createdat || course.CreatedAt,
          isCompleted: course.iscompleted,
          isPublished: course.accept
        })),
        stats: {
          totalCourses,
          publishedCourses,
          totalEnrollments,
          totalRatings,
          averageRating
        }
      }
    });
  } catch (error) {
    console.error('Error fetching instructor info:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin giảng viên',
      error: error.message
    });
  }
};

module.exports = {
  getInstructorById
};
