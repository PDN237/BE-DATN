const authService = require('../services/auth.service');
const jwt = require('jsonwebtoken');
const db = require('../db.js');

const SECRET_KEY = 'lms-datn-group-66-secret-key-2024'; // Change in production!

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập Email và Password'
      });
    }

    // Find user by email
    const user = await authService.findByEmail(email);
    if (!user || user.PassWord !== password) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác'
      });
    }

    // Generate JWT token (expires 7 days)
    const token = jwt.sign(
      { 
        userId: user.UserID, 
        email: user.Email, 
        fullName: user.FullName,
        roleId: user.RoleID 
      },
      SECRET_KEY,
      { expiresIn: '7d' }
    );

    // Set cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: false, // true in production HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      user: {
        id: user.UserID,
        fullName: user.FullName,
        email: user.Email,
        roleId: user.RoleID,
        avatarUrl: user.AvatarUrl
      }
    });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống, vui lòng thử lại'
    });
  }
};

// 🧪 Test credentials (từ DB INSERT):
// admin@lms.com / admin123 (Admin - Role 1)
// teacher@lms.com / teacher123 (Instructor - Role 2)
// student1@gmail.com / 123456 (Student - Role 3)

