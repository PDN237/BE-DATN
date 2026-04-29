const pool = require('../db');

const CourseUpdateRequestController = {
  // POST /api/course-update-requests
  // Submit an update request for a published course
  submitUpdateRequest: async (req, res) => {
    try {
      const { CourseID, UserID, RequestData, Reason } = req.body;

      if (!CourseID || !UserID || !RequestData) {
        return res.status(400).json({ success: false, message: 'CourseID, UserID, and RequestData are required' });
      }

      // Check if course exists and is published
      const courseResult = await pool.query(
        'SELECT CourseID, Accept, IsCompleted FROM Courses WHERE CourseID = $1',
        [parseInt(CourseID)]
      );

      if (!courseResult.rows.length) {
        return res.status(404).json({ success: false, message: 'Khóa học không tồn tại' });
      }

      const course = courseResult.rows[0];

      // Only allow update requests for published courses
      if (!course.accept || !course.iscompleted) {
        return res.status(400).json({ 
          success: false, 
          message: 'Chỉ có thể gửi yêu cầu cập nhật cho khóa học đã xuất bản' 
        });
      }

      // Check if there's already a pending request for this course
      const pendingRequest = await pool.query(
        `SELECT RequestID FROM CourseUpdateRequests 
         WHERE CourseID = $1 AND Status = 'pending'`,
        [parseInt(CourseID)]
      );

      if (pendingRequest.rows.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Đang có yêu cầu cập nhật đang chờ duyệt cho khóa học này' 
        });
      }

      // Create the update request
      const result = await pool.query(
        `INSERT INTO CourseUpdateRequests (CourseID, UserID, RequestData, Reason, Status, CreatedAt, UpdatedAt)
         VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())
         RETURNING *`,
        [
          parseInt(CourseID),
          parseInt(UserID),
          JSON.stringify(RequestData),
          Reason || ''
        ]
      );

      const request = result.rows[0];

      res.status(201).json({
        success: true,
        message: 'Đã gửi yêu cầu cập nhật khóa học! Vui lòng chờ Admin phê duyệt.',
        request: {
          RequestID: request.requestid,
          CourseID: request.courseid,
          UserID: request.userid,
          Status: request.status,
          Reason: request.reason,
          CreatedAt: request.createdat
        }
      });
    } catch (err) {
      console.error('submitUpdateRequest error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/course-update-requests
  // Get all update requests (for admin)
  getAllUpdateRequests: async (req, res) => {
    try {
      const status = req.query.status || 'all';
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const size = Math.max(1, Math.min(50, parseInt(req.query.size) || 10));
      const offset = (page - 1) * size;

      let whereClause = '';
      const params = [size, offset];

      if (status !== 'all') {
        whereClause = 'WHERE cur.Status = $3';
        params.push(status);
      }

      const result = await pool.query(
        `SELECT cur.*, c.Title as CourseTitle, c.Thumbnail as CourseThumbnail, 
                u.Username as InstructorName, u.Email as InstructorEmail
         FROM CourseUpdateRequests cur
         JOIN Courses c ON cur.CourseID = c.CourseID
         JOIN Users u ON cur.UserID = u.UserID
         ${whereClause}
         ORDER BY cur.CreatedAt DESC
         LIMIT $1 OFFSET $2`,
        params
      );

      const requests = result.rows.map(r => ({
        RequestID: r.requestid,
        CourseID: r.courseid,
        UserID: r.userid,
        Status: r.status,
        RequestData: r.requestdata,
        Reason: r.reason,
        AdminFeedback: r.adminfeedback,
        CreatedAt: r.createdat,
        UpdatedAt: r.updatedat,
        CourseTitle: r.coursetitle,
        CourseThumbnail: r.coursethumbnail,
        InstructorName: r.instructorname,
        InstructorEmail: r.instructoremail
      }));

      // Get total count
      let countResult;
      if (status !== 'all') {
        countResult = await pool.query(
          'SELECT COUNT(*) as total FROM CourseUpdateRequests WHERE Status = $1',
          [status]
        );
      } else {
        countResult = await pool.query(
          'SELECT COUNT(*) as total FROM CourseUpdateRequests'
        );
      }

      const total = parseInt(countResult.rows[0].total || 0);

      res.json({
        success: true,
        requests,
        pagination: {
          page,
          size,
          total,
          totalPages: Math.ceil(total / size)
        }
      });
    } catch (err) {
      console.error('getAllUpdateRequests error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/course-update-requests/course/:courseId
  // Get update requests for a specific course (for instructor)
  getUpdateRequestsByCourse: async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const userId = parseInt(req.query.userId) || 0;

      // Verify ownership
      const courseCheck = await pool.query(
        'SELECT CourseID FROM Courses WHERE CourseID = $1 AND UserID = $2',
        [courseId, userId]
      );

      if (!courseCheck.rows.length) {
        return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
      }

      const result = await pool.query(
        `SELECT * FROM CourseUpdateRequests 
         WHERE CourseID = $1 
         ORDER BY CreatedAt DESC`,
        [courseId]
      );

      const requests = result.rows.map(r => ({
        RequestID: r.requestid,
        CourseID: r.courseid,
        UserID: r.userid,
        Status: r.status,
        RequestData: r.requestdata,
        Reason: r.reason,
        AdminFeedback: r.adminfeedback,
        CreatedAt: r.createdat,
        UpdatedAt: r.updatedat
      }));

      res.json({ success: true, requests });
    } catch (err) {
      console.error('getUpdateRequestsByCourse error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // PUT /api/course-update-requests/:id/approve
  // Approve an update request and apply changes to the course
  approveUpdateRequest: async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);

      // Get the request
      const requestResult = await pool.query(
        'SELECT * FROM CourseUpdateRequests WHERE RequestID = $1',
        [requestId]
      );

      if (!requestResult.rows.length) {
        return res.status(404).json({ success: false, message: 'Yêu cầu không tồn tại' });
      }

      const request = requestResult.rows[0];

      if (request.status !== 'pending') {
        return res.status(400).json({ 
          success: false, 
          message: 'Yêu cầu này đã được xử lý' 
        });
      }

      const requestData = request.requestdata;

      // Apply the changes based on RequestData
      // This is a simplified version - in production, you'd want more sophisticated diff application
      if (requestData.modules) {
        // Update modules
        for (const module of requestData.modules) {
          if (module.ModuleID) {
            // Update existing module
            await pool.query(
              'UPDATE Modules SET Title = $1, Description = $2, OrderIndex = $3 WHERE ModuleID = $4',
              [module.Title, module.Description || '', module.OrderIndex || 0, module.ModuleID]
            );
          } else {
            // Create new module
            await pool.query(
              'INSERT INTO Modules (CourseID, Title, Description, OrderIndex, CreatedAt) VALUES ($1, $2, $3, $4, NOW())',
              [request.courseid, module.Title, module.Description || '', module.OrderIndex || 0]
            );
          }
        }
      }

      if (requestData.lessons) {
        // Update lessons
        for (const lesson of requestData.lessons) {
          if (lesson.LessonID) {
            await pool.query(
              `UPDATE Lessons SET Title = $1, Type = $2, ContentUrl = $3, ContentHtml = $4, 
               Duration = $5, OrderIndex = $6, "describe" = $7, "summary" = $8, score = $9
               WHERE LessonID = $10`,
              [
                lesson.Title, lesson.Type, lesson.ContentUrl || '', lesson.ContentHtml || '',
                lesson.Duration || 0, lesson.OrderIndex || 0, lesson.Describe || '', 
                lesson.Summary || '', lesson.score || 0, lesson.LessonID
              ]
            );
          } else {
            await pool.query(
              `INSERT INTO Lessons (ModuleID, Title, Type, ContentUrl, ContentHtml, Duration, OrderIndex, "describe", "summary", score)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [
                lesson.ModuleID, lesson.Title, lesson.Type, lesson.ContentUrl || '', 
                lesson.ContentHtml || '', lesson.Duration || 0, lesson.OrderIndex || 0,
                lesson.Describe || '', lesson.Summary || '', lesson.score || 0
              ]
            );
          }
        }
      }

      // Update request status
      await pool.query(
        `UPDATE CourseUpdateRequests 
         SET Status = 'approved', AdminFeedback = '', UpdatedAt = NOW() 
         WHERE RequestID = $1`,
        [requestId]
      );

      res.json({ 
        success: true, 
        message: 'Đã phê duyệt và áp dụng cập nhật cho khóa học!' 
      });
    } catch (err) {
      console.error('approveUpdateRequest error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // PUT /api/course-update-requests/:id/reject
  // Reject an update request
  rejectUpdateRequest: async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const { AdminFeedback } = req.body;

      if (!AdminFeedback) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do từ chối' });
      }

      const requestResult = await pool.query(
        'SELECT * FROM CourseUpdateRequests WHERE RequestID = $1',
        [requestId]
      );

      if (!requestResult.rows.length) {
        return res.status(404).json({ success: false, message: 'Yêu cầu không tồn tại' });
      }

      const request = requestResult.rows[0];

      if (request.status !== 'pending') {
        return res.status(400).json({ 
          success: false, 
          message: 'Yêu cầu này đã được xử lý' 
        });
      }

      await pool.query(
        `UPDATE CourseUpdateRequests 
         SET Status = 'rejected', AdminFeedback = $2, UpdatedAt = NOW() 
         WHERE RequestID = $1`,
        [requestId, AdminFeedback]
      );

      res.json({ 
        success: true, 
        message: 'Đã từ chối yêu cầu cập nhật và gửi feedback!' 
      });
    } catch (err) {
      console.error('rejectUpdateRequest error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/course-update-requests/:id
  // Get a single update request with details
  getUpdateRequestById: async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);

      const result = await pool.query(
        `SELECT cur.*, c.Title as CourseTitle, c.Thumbnail as CourseThumbnail, 
                u.Username as InstructorName, u.Email as InstructorEmail
         FROM CourseUpdateRequests cur
         JOIN Courses c ON cur.CourseID = c.CourseID
         JOIN Users u ON cur.UserID = u.UserID
         WHERE cur.RequestID = $1`,
        [requestId]
      );

      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'Yêu cầu không tồn tại' });
      }

      const request = result.rows[0];

      res.json({
        success: true,
        request: {
          RequestID: request.requestid,
          CourseID: request.courseid,
          UserID: request.userid,
          Status: request.status,
          RequestData: request.requestdata,
          Reason: request.reason,
          AdminFeedback: request.adminfeedback,
          CreatedAt: request.createdat,
          UpdatedAt: request.updatedat,
          CourseTitle: request.coursetitle,
          CourseThumbnail: request.coursethumbnail,
          InstructorName: request.instructorname,
          InstructorEmail: request.instructoremail
        }
      });
    } catch (err) {
      console.error('getUpdateRequestById error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = CourseUpdateRequestController;
