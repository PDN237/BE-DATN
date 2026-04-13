const pool = require('../db');

const BeInstructorController = {
  // PUT /api/instructor/become
  becomeInstructor: async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, message: 'userId required' });
      }

      // Check current role
      const check = await pool.query('SELECT roleid FROM Users WHERE userid = $1', [parseInt(userId)]);
      if (!check.rows.length) {
        return res.status(404).json({ success: false, message: 'User không tồn tại' });
      }

      const currentRole = check.rows[0].roleid;
      if (currentRole === 4) {
        return res.json({ success: true, message: 'Bạn đã là Instructor rồi!' });
      }
      if (currentRole === 1) {
        return res.status(400).json({ success: false, message: 'Admin không cần đăng ký Instructor' });
      }

      // Update role to Instructor (RoleID = 4)
      await pool.query('UPDATE Users SET roleid = 4, updatedat = NOW() WHERE userid = $1', [parseInt(userId)]);

      res.json({ success: true, message: 'Chúc mừng! Bạn đã trở thành Instructor!' });
    } catch (err) {
      console.error('becomeInstructor error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = BeInstructorController;
