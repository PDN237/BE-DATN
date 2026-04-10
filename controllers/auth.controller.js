const authService = require('../services/auth.service');

exports.register = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ: Họ tên, Email, Mật khẩu'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email không hợp lệ'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải từ 6 ký tự trở lên'
      });
    }

    await authService.register(fullName.trim(), email.trim(), password);

    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công! Bạn có thể đăng nhập ngay.'
    });

  } catch (err) {
    console.error('Register error:', err.message);

    if (err.message === 'Email đã được sử dụng') {
      return res.status(409).json({
        success: false,
        message: 'Email đã được sử dụng'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống, vui lòng thử lại sau'
    });
  }
};
