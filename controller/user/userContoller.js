const User = require('../../models/userSchema');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const Product = require('../../models/productSchema');
const crypto = require('crypto');
const Wallet=require('../../models/walletSchema')

const loadHome = async (req, res) => {
    try {
        const user = req.session.user;
        
        // Fetch latest products
        const latestProducts = await Product.find({ isBlocked: false })
            .sort({ createdOn: -1 })
            .limit(8)
            .populate('category', 'name');

        // Fetch featured/best-selling products (example criteria)
        const featuredProducts = await Product.find({ 
            isBlocked: false,
            quantity: { $gt: 0 }
        })
        .sort({ salePrice: -1 }) // Example: showing higher-priced items as featured
        .limit(8)
        .populate('category', 'name');

        console.log('latestProducts:', latestProducts);
        console.log('featuredProducts:', featuredProducts);

        res.render('home', {
            user,
            latestProducts,
            featuredProducts,
            title: 'Verses Store - Home'
        });

    } catch (error) {
        console.error('Home page error:', error.message);
        
    }
};


const loadPageNotFound=async(req,res)=>{
    try {
        res.render("page-404")
    } catch (error) {
        
    }

}    


const loadSingnup=async (req,res)=>{
    try {
        res.render('signup')
    } catch (error) {
        res.status(500).send('Server error');
    }
}

const logout=async (req,res)=>{
    try {
        req.session.user=null
        console.log('logout successfully')
        res.redirect('/')
    } catch (error) {
        return res.status(500).send('Server error');
    }
}



const loadsignin= async (req, res) => {
    try {
        res.render('signin'); 
    } catch (error) {
        console.error('Error rendering signup page:', error);
        res.status(500).send('Server error');
    }
};


const loadOtpPage= async (req, res) => {
    try {
        console.log('Loading OTP page');
        res.render('otpVerify'); 
    } catch (error) {
        console.error('Error rendering signup page:', error);
        res.status(500).send('Server error');
    }
};



function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString();
}

function generateOtpWithExpiry() {
    return {
        code: Math.floor(100000 + Math.random() * 900000).toString(),
        expiresAt: Date.now() + 5* 60 * 1000 // 10 minutes expiry
    };
}

async function otpSend(email, otp) {
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
            subject: 'Verses Store - OTP Verification',
            html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2 style="color: #007bff;">Verses Store - OTP Verification</h2>
                    <p>Dear User,</p>
                    <p>Thank you for signing up at <strong>Verses Store</strong>. To complete your registration, please use the following One-Time Password (OTP):</p>
                    <h3 style="background-color: #f4f4f4; padding: 10px; display: inline-block; border-radius: 5px;">${otp}</h3>
                    <p>This OTP is valid for the next 10 minutes. Please do not share it with anyone.</p>
                    <p>If you did not request this, please ignore this email.</p>
                    <p>Best regards,</p>
                    <p><strong>Verses Store Team</strong></p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`OTP sent to ${email}: ${otp}`);
        return info.accepted.length > 0;
        
    } catch (error) {
        console.error("Error sending email:", error.message);
        return false;
    }
}



const signup = async (req, res) => {
    try {
        const { name, email, password, confirmPassword, referralCode } = req.body;
        console.log(req)

        // Check if referral code exists
        if (referralCode) {
            const referrer = await User.findOne({ referalCode: referralCode });
            if (!referrer) {
                return res.json({ message: 'Invalid referral code' });
            }
        }

        if (password !== confirmPassword) {
            return res.json({ message: 'Password and confirm password do not match.' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.json({ message: 'User already exists with this email.' });
        }

        // Generate unique referral code
        const newReferralCode = crypto.randomBytes(4).toString('hex');

        const otpData = generateOtpWithExpiry();
        const emailSent = await otpSend(email, otpData.code);
       
        
        console.log('otp', otpData.code);
        req.session.otp = otpData.code;
        req.session.otpExpiry = otpData.expiresAt;
        req.session.userData = { 
            name, 
            email, 
            password,
            referalCode: newReferralCode,
            referredBy: referralCode || null
        };

        return res.redirect('/verifyOtp');

    } catch (error) {
        console.error('Error in signup:', error);
        res.status(500).send('Server error');
    }
};




const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;

        // Check if OTP has expired
        if (!req.session.otpExpiry || Date.now() > req.session.otpExpiry) {
            return res.json({
                success: false,
                message: 'OTP has expired. Please request a new one.',
                expired: true
            });
        }

        if (req.session.otp === otp) {
            const { name, email, password, referalCode, referredBy } = req.session.userData;
    
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create new user
            const newUser = new User({ 
                name, 
                email, 
                password: hashedPassword,
                referalCode
            });

            await newUser.save();

            // Create wallet for new user
            const newWallet = new Wallet({
                user: newUser._id,
                balance: 0,
                history: []
            });
            await newWallet.save();

            // Handle referral if exists
            if (referredBy) {
                const referrer = await User.findOne({ referalCode: referredBy });
                if (referrer) {
                    // Find or create referrer's wallet
                    let referrerWallet = await Wallet.findOne({ user: referrer._id });
                    if (!referrerWallet) {
                        referrerWallet = new Wallet({
                            user: referrer._id,
                            balance: 0,
                            history: []
                        });
                    }

                    // Add bonus to referrer's wallet
                    referrerWallet.balance += 100;
                    referrerWallet.history.push({
                        amount: 100,
                        status: "credit",
                        description: `Referral bonus for referring ${email}`
                    });
                    await referrerWallet.save();

                    // Add bonus to new user's wallet
                    newWallet.balance += 100;
                    newWallet.history.push({
                        amount: 100,
                        status: "credit",
                        description: "Welcome bonus from referral"
                    });
                    await newWallet.save();

                    // Update referrer's referral list
                    await User.findByIdAndUpdate(referrer._id, {
                        $push: { redeemedUsers: newUser._id }
                    });
                }
            }


            const user= await User.findOne({ email: email });
            req.session.user = user; // Store user in session
            console.log('User created successfully:', user); 

            // Clean up session
            delete req.session.otp;
            delete req.session.otpExpiry;
           
            delete req.session.userData // Store user data in session
            
            return res.json({
                success: true,
                message: 'Account created successfully! Please login to continue.'
            });
        }

        return res.json({
            success: false,
            message: 'Invalid OTP. Please try again.'
        });

    } catch (error) {
        console.error('Error verifying OTP:', error);
        return res.json({
            success: false,
            message: 'Server error occurred'
        });
    }
};



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





const signin = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log("Sign in request:", req.body);

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isBlocked) {
            return res.status(403).json({ message: 'Your account is blocked. Please contact support.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        req.session.user = user;
        return res.status(200).json({ message: 'Login successful' });

    } catch (error) {
        console.error('Error in sign in:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};





  
  const verifyEmail = async (req, res) => {
    try {
        const { email } = req.body;
        console.log(email);

        // Await the user search
        const user = await User.findOne({ email });
        console.log(user);

        if (!user) {
            return res.json({ success: false, message: 'Invalid email' });
        }

        const otp = generateOtp();
        console.log(otp);

        const emailSent = await resetPasswordOtp(email, otp);
        if (!emailSent) {
            return res.json({ success: false, message: 'Error sending OTP. Please try again.' });
        }

        req.session.otp = otp;
        req.session.email = email;

         res.json({ success: true, message: 'Check your email for the OTP.' })

    } catch (error) {
        console.error('Error in verifyEmail:', error);
        return res.json({ success: false, message: 'Server error' });
    }
};


const otpVerify = async(req, res) => {
    try {
        const {otp} = req.body;
        console.log(otp);
        
        if(req.session.otp == otp) {
            return res.json({
                success: true,
                message: 'OTP verified successfully'
            });
        } else {
            return res.json({
                success: false,
                message: 'Invalid OTP. Please try again.',
                resetTimer: true
            });
        }
    } catch (error) {
        console.error('Error in OTP verification:', error);
        return res.json({
            success: false,
            message: 'Server error occurred',
            resetTimer: true
        });
    }
}

const resendOtp = async(req, res) => {
    try {
        const email = req.session.email;
        console.log('resend', email);

        const otpData = generateOtpWithExpiry();
        const sent = await otpSend(email, otpData.code);

        console.log('sent', sent)
        if (sent) {
            req.session.otp = otpData.code;
            req.session.otpExpiry = otpData.expiresAt;
            return res.json({
                success: true,
                message: 'OTP has been resent to your email'
            });
        } else {
            return res.json({
                success: false,
                message: 'Failed to send OTP. Please try again.'
            });
        }
    } catch (error) {
        console.error('Error in resend OTP:', error);
        return res.json({
            success: false,
            message: 'Server error occurred'
        });
    }
}

    const changePassword = async (req, res) => {
        try {
            const { password, confirmPassword } = req.body;
            const email = req.session.email;
            console.log(email);
    
            if (password !== confirmPassword) {
                return res.status(400).json({ message: "Passwords do not match" });
            }
    
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
    
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
    
            user.password = hashedPassword;
            await user.save();
            console.log('password changed successfully', password);
            console.log(user);
    
            delete req.session.email;
            delete req.session.otp;
    
            // Send a success message
            return res.status(200).json({ message: "Password changed successfully" });
        } catch (error) {
            res.status(500).json({ message: "Server error", error });
        }
    };
    



const loadPasswordPage=async(req,res)=>{
    try {
        res.render('newPassword');  
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
}

const loadForgotPasswordPage=async(req,res)=>{
    try {
        res.render('forgotPassword')
    } catch (error) {
        res.status(500)
    }
}



const loadFFOtpPage= async (req, res) => {
    try {
        console.log('Loading OTP page');
        res.render('otp-page'); 
    } catch (error) {
        console.error('Error rendering signup page:', error);
        res.status(500).send('Server error');
    }
};



module.exports={
    loadHome,
    loadSingnup,
    loadsignin,
    signup,
    loadOtpPage,
    verifyOtp,
    signin,
    logout,
    verifyEmail,
    changePassword,
    otpVerify,
    loadPasswordPage,
    resendOtp,
    loadForgotPasswordPage,
    loadFFOtpPage,
    loadPageNotFound
     
}




