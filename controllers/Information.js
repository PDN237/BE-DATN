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
    
    // Get instructor's courses (both published and draft)
    const coursesQuery = `
      SELECT CourseID, Title, Description, Level, Thumbnail, CreatedAt, iscompleted, accept
      FROM Courses
      WHERE UserID = $1
      ORDER BY CreatedAt DESC
    `;
    const coursesResult = await pool.query(coursesQuery, [instructorId]);
    
    // Count total courses and published courses
    const totalCourses = coursesResult.rows.length;
    const publishedCourses = coursesResult.rows.filter(c => c.iscompleted && c.accept).length;
    
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
          publishedCourses
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
