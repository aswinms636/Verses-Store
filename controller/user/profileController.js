const User=require('../../models/userSchema');
const Address=require("../../models/addressSchema")
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Store OTPs temporarily (in production, use Redis or similar)
const otpStore = new Map();

const loadProfilePage= (req, res) => {
    try {
        const user = req.session.user;

        console.log("user_____________",user)
        if (!user) {
            return res.redirect("/signin",{message:"Please login to view your profile"});
        }
        res.render("profile", { user });
    } catch (error) {
        console.error("Error loading profile page:", error);
        res.redirect("/pageNotfound");
    }
}



const editProfile = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { name, email, phone } = req.body;

        // Basic validation
        if (!name || !email) {
            return res.json({ 
                success: false, 
                message: 'Name and email are required' 
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.json({ 
                success: false, 
                message: 'Please enter a valid email address' 
            });
        }

        // Check if email already exists for another user
        const existingUser = await User.findOne({ 
            email, 
            _id: { $ne: userId } 
        });
        
        if (existingUser) {
            return res.json({ 
                success: false, 
                message: 'Email address is already in use' 
            });
        }

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { 
                name: name.trim(),
                email: email.trim(),
                phone: phone ? phone.trim() : ''
            },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Update session user data
        req.session.user = updatedUser;
        
        // Send success response
        res.json({ 
            success: true, 
            message: 'Profile updated successfully', 
            user: updatedUser 
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.json({ 
            success: false, 
            message: 'Failed to update profile' 
        });
    }
};

function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString();
}

async function resetPasswordOtp(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.VERIFY_EMAIL, 
                pass: process.env.EMAIL_PASSWORD 
            }
        });

        const mailOptions = {
            from: `"Verses Store" <${process.env.VERIFY_EMAIL}>`,
            to: email,
            subject: 'Verses Store - Password Reset OTP',
            html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2 style="color: #007bff;">Verses Store - Password Reset Request</h2>
                    <p>Dear User,</p>
                    <p>We received a request to reset your password for your <strong>Verses Store</strong> account. Use the One-Time Password (OTP) below to proceed with resetting your password:</p>
                    <h3 style="background-color: #f4f4f4; padding: 10px; display: inline-block; border-radius: 5px;">${otp}</h3>
                    <p>This OTP is valid for the next 10 minutes. Please do not share it with anyone.</p>
                    <p>If you did not request this password reset, please ignore this email or contact our support team immediately.</p>
                    <p>Best regards,</p>
                    <p><strong>Verses Store Team</strong></p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Password reset OTP sent to ${email}: ${otp}`);
        return info.accepted.length > 0;
        
    } catch (error) {
        console.error("Error sending email:", error.message);
        return false;
    }
}

const sendPasswordOtp = async (req, res) => {
    try {
        const userId = req.session.user._id;
        console.log("userId",userId)
        const user = await User.findById(userId);

        console.log("user",user)

        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        const otp = generateOtp();
        
        // Store OTP with expiry (2 minutes)
        otpStore.set(userId, {
            otp,
            expiry: Date.now() + 2 * 60 * 1000
        });

        // Send OTP via email
        const sent = await resetPasswordOtp(user.email, otp);
        console.log("sent",user.email,otp)
        console.log(user)

console.log("sent",sent)

console.log('email sent otp',otp)

console.log('email sent successfully')
        
        

        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.json({ success: false, message: 'Internal server error' });
    }
};

const verifyPasswordOtp = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { code } = req.body;

        if (!code) {
            return res.json({ 
                success: false, 
                message: 'OTP is required' 
            });
        }

        const storedData = otpStore.get(userId);
        if (!storedData) {
            return res.json({ 
                success: false, 
                message: 'OTP expired or not found' 
            });
        }

        if (Date.now() > storedData.expiry) {
            otpStore.delete(userId);
            return res.json({ 
                success: false, 
                message: 'OTP has expired' 
            });
        }

        if (storedData.otp !== code) {
            return res.json({ 
                success: false, 
                message: 'Invalid OTP' 
            });
        }

        // Clear OTP after successful verification
        otpStore.delete(userId);

        // Send success response
        return res.json({ 
            success: true, 
            message: 'OTP verified successfully' 
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        return res.json({ 
            success: false, 
            message: 'Failed to verify OTP' 
        });
    }
};

const changePassword = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { newPassword, confirmPassword } = req.body;
        console.log('req.body',req.body)

        // Validate inputs
        if (!newPassword || !confirmPassword) {
            return res.json({ success: false, message: 'All fields are required' });
        }

        if (newPassword !== confirmPassword) {
            return res.json({ success: false, message: 'Passwords do not match' });
        }

        // Password validation regex
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.json({ 
                success: false, 
                message: 'Password must meet all requirements' 
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        // Remove current password verification since we already verified via OTP
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        console.log("Password changed successfully for user:", userId);
        req.session.user = user; // Update session with new password

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: 'Failed to change password' });
    }
};

// Configure multer for profile photo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/Uploads/profile-photos');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only .png, .jpg, .jpeg, and .webp files are allowed!'));
    }
}).single('profilePhoto');

// Add these new controller methods
const uploadProfilePhoto = async (req, res) => {
    try {
        upload(req, res, async (err) => {
            if (err) {
                return res.json({
                    success: false,
                    message: err.message
                });
            }

            if (!req.file) {
                return res.json({
                    success: false,
                    message: 'Please select an image to upload'
                });
            }

            const userId = req.session.user._id;
            const user = await User.findById(userId);

            // Delete old profile photo if it exists and isn't the default
            if (user.profilePhoto && user.profilePhoto !== 'default-profile.jpg') {
                const oldPhotoPath = path.join('public/uploads/profile-photos', user.profilePhoto);
                if (fs.existsSync(oldPhotoPath)) {
                    fs.unlinkSync(oldPhotoPath);
                }
            }

            // Update user profile photo
            user.profilePhoto = req.file.filename;
            await user.save();
            req.session.user = user;

            res.json({
                success: true,
                message: 'Profile photo updated successfully',
                photoUrl: `/uploads/profile-photos/${req.file.filename}`
            });
        });
    } catch (error) {
        console.error('Error uploading profile photo:', error);
        res.json({
            success: false,
            message: 'Failed to upload profile photo'
        });
    }
};

const removeProfilePhoto = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);

        if (user.profilePhoto && user.profilePhoto !== 'default-profile.jpg') {
            const photoPath = path.join('public/uploads/profile-photos', user.profilePhoto);
            if (fs.existsSync(photoPath)) {
                fs.unlinkSync(photoPath);
            }
        }

        user.profilePhoto = 'default-profile.jpg';
        await user.save();
        req.session.user = user;

        res.json({
            success: true,
            message: 'Profile photo removed successfully',
            photoUrl: '/uploads/profile-photos/default-profile.jpg'
        });
    } catch (error) {
        console.error('Error removing profile photo:', error);
        res.json({
            success: false,
            message: 'Failed to remove profile photo'
        });
    }
};

// Add to module.exports
module.exports = {  
    loadProfilePage,
    editProfile,
    sendPasswordOtp,
    verifyPasswordOtp,
    changePassword,
    uploadProfilePhoto,
    removeProfilePhoto
  
};