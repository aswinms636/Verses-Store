const Admin = require("../../models/userSchema");
const bcrypt = require("bcrypt");
const User = require("../../models/userSchema");

const loadlogin = async (req, res) => {
    try {
        res.render('admin-login')
    } catch (error) {
        res.status(500).send('server error')
    }
}

const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await Admin.findOne({ email });

        if (!admin) {
            return res.json({
                success: false,
                message: 'Invalid email address'
            });
        }

        // Check if user is admin
        if (!admin.isAdmin) {
            return res.json({
                success: false,
                message: 'Access denied. Not an admin account.'
            });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.json({
                success: false,
                message: 'Invalid password'
            });
        }

        req.session.admin = admin;
        return res.json({
            success: true,
            redirectUrl: '/admin/dashboard'
        });

    } catch (error) {
        console.error("Admin login error:", error);
        return res.json({
            success: false,
            message: 'Server error occurred'
        });
    }
};

const loadDashboard = async (req, res) => {
    try {
        res.render('dashboard')
    } catch (error) {
        res.status(500).send("Server error");
    }
}

const logout = async (req, res) => {
    try {
        req.session.admin = null
        res.redirect('/admin/login')
    } catch (error) {
        res.status(500).send('logout error')
    }
}

const blockUser = async (req, res) => {
    try {
        const userId = req.query.id;
        if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
            return res.status(400).send('Invalid user ID');
        }

        const user = await User.findByIdAndUpdate(userId, { isBlocked: true }, { new: true });
        if (!user) {
            return res.status(404).send('User not found');
        }

        res.redirect('/admin/users?status=success&message=User blocked successfully');
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).send('Failed to block user');
    }
};

// Function to unblock a user
const unblockUser = async (req, res) => {
    try {
        const userId = req.query.id;
        if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
            return res.status(400).send('Invalid user ID');
        }

        const user = await User.findByIdAndUpdate(userId, { isBlocked: false }, { new: true });
        if (!user) {
            return res.status(404).send('User not found');
        }

        res.redirect('/admin/users?status=success&message=User unblocked successfully');
    } catch (error) {
        console.error('Error unblocking user:', error);
        res.status(500).send('Failed to unblock user');
    }
};

const toggleUserStatus = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Toggle blocked status
        user.isBlocked = !user.isBlocked;
        await user.save();

        res.json({
            success: true,
            isBlocked: user.isBlocked,
            message: `User has been ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`
        });

    } catch (error) {
        console.error('Toggle user status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    adminLogin,
    loadlogin,
    loadDashboard,
    logout,
    blockUser,
    unblockUser,
    toggleUserStatus,
}