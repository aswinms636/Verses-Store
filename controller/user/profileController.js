const User=require('../../models/userSchema');
const Address=require("../../models/addressSchema")
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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
        const userId = req.session.user._id; // Assuming you have user authentication middleware
        const { name, email, phone } = req.body;

        console.log('1')

        // Find the user by ID and update the fields
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { name, email, phone },
            { new: true, runValidators: true }
        );

        console.log('2',updatedUser)

        if (!updatedUser) {
            return res.json({ success:false, message: 'User not found' });
        }

        console.log("3");
        
        // Send a success response
        res.status(200).json({ success:true, message: 'Profile updated successfully', user: updatedUser });
    } catch (error) {
        console.error(error);
        res.json({ success:false, message: 'Internal Server Error' });
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
            return res.json({ success: false, message: 'OTP is required' });
        }

        const storedData = otpStore.get(userId);
        if (!storedData) {
            return res.json({ success: false, message: 'OTP expired or not found' });
        }

        if (Date.now() > storedData.expiry) {
            otpStore.delete(userId);
            return res.json({ success: false, message: 'OTP has expired' });
        }

        if (storedData.otp !== code) {
            return res.json({ success: false, message: 'Invalid OTP' });
        }

        otpStore.delete(userId);

       
        res.json({ success: true, message: 'OTP verified successfully' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: 'Failed to verify OTP' });
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

module.exports = {  
    loadProfilePage,
    editProfile,
    sendPasswordOtp,
    verifyPasswordOtp,
    changePassword
  
};