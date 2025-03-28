const User = require('../../models/userSchema');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');


const loadHome = async (req, res) => {
    try {
        const user=req.session.user
        console.log("home--------------------",user)
        if(user){
            res.render('home',{user})
        }else{
            res.render('home')
        }
      
    } catch (error) {
        console.error('Home page not found:', error);
        res.status(500).send('Server error');
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

        const { name, email, password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
           res.json({message:'Password and confirm password do not match.'})
            return res.redirect('/signup');
        }

        const user = await User.findOne({ email });
        if (user) {
            res.json({message:'User already exists with this email.'})
            return res.redirect('/signup');
        }
        

        const otp = generateOtp();
        const emailSent = await otpSend(email, otp);
        if (!emailSent) {
            res.json({message:'Error sending OTP. Please try again.'})
            return res.redirect('/signup');
        }
        

        req.session.otp = otp;
        req.session.userData = { name, email, password };

        console.log("USER DATA",req.session.userData)
       
        console.log('Redirecting to OTP verification page');
        return res.redirect('/verifyOtp');

    } catch (error) {
        console.error('Error in signup:', error);
        res.status(500).send('Server error');
    }
};




const verifyOtp = async (req, res) => {
    try {
        
        const { otp } = req.body;
        console.log(otp)

        if ( req.session.otp === otp) {

            const { name, email, password } = req.session.userData;
    
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            const newUser = new User({ name, email,password: hashedPassword });
            console.log(newUser)
            await newUser.save();

            delete req.session.otp
            delete req.session.userData

            
            return res.redirect('/signin');
        } else { 
            return res.redirect('/verifyOtp');
        }

    } catch (error) {
        console.error('Error verifying OTP:', error);
        return res.status(500).send('Server error');
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
        res.json({message:'User not found'})
        return res.redirect('/signup');
      }
  
      
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        res.json({message:'Invalid credentials'})
        return res.redirect('/login');
      }
  
      req.session.user = user;
      return res.redirect('/')
  
    } catch (error) {
      console.error('Error in sign in:', error);
      return res.status(500).send('Server error');
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
            res.json({message:'User not found'})
            return res.redirect('/login');
        }

        const otp = generateOtp();
        console.log(otp);

        const emailSent = await resetPasswordOtp(email, otp);
        if (!emailSent) {
            res.json({message:'Error sending OTP. Please try again.'})
            return res.redirect('/login');
        }

        req.session.Otp = otp;
        req.session.email=email

        return res.redirect('/otpVerify');
        
    } catch (error) {
        console.error('Error in verifyEmail:', error);
        res.json({message:'Server error'})
        return res.redirect('/forgot-Password');
    }
};



const otpVerify=async(req,res)=>{
    try {
        const {otp}=req.body
        console.log(otp)
        if(req.session.Otp==otp){
            return res.redirect('/newPassword')
        }
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
}


const resendOtp=async (req,res)=>{
    try {
        const email=req.session.email
        console.log('resend',email)
    
       const otp= generateOtp()
        otpSend(email,otp)

        req.session.Otp=otp
    
        res.redirect('otpVerify')
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
    }

const changePassword=async(req,res)=>{
    try {
        const {password, confirmPassword } = req.body;
        const email=req.session.email
        console.log(email)

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
        console.log('password changed successfully',password)
        console.log(user)

        delete req.session.email
        delete req.session.otp

        res.redirect('/signin')
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
}



const loadPasswordPage=async(req,res)=>{
    try {
        res.render('newPassword')    
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




