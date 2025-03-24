const User = require('../../models/userSchema');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');


const loadHome = async (req, res) => {
    try {
        const user=req.session.userData.name;
        console.log("home",user)
        res.render("home",{user})

    } catch (error) {
        console.error('Home page not found:', error);
        res.status(500).send('Server error');
    }
};



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
        res.render('otp-page'); 
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









module.exports={
    loadHome,
    loadSingnup,
    loadsignin,
    signup,
    loadOtpPage,
    verifyOtp,
    signin,
    logout
}




