const express = require('express');
const router = express.Router();
const userController = require('../controller/user/userContoller'); 
const { isLogin,checkSession }=require('../middlewares/userAuthentic')
 const shopController=require('../controller/user/shopController')
const passport=require('../config/passport')



router.get("/",userController.loadHome);
router.get("/signup",isLogin,userController.loadSingnup)
router.get("/signin",userController.loadsignin);
router.post("/signin",isLogin,userController.signin);
router.post("/signup",userController.signup);
router.get("/verifyOtp",isLogin,userController.loadOtpPage);
router.post("/verifyOtp",userController.verifyOtp);
router.get("/logout",userController.logout);



router.post('/verifyEmail',userController.verifyEmail)
router.get('/forgot-Password',userController.loadForgotPasswordPage)
router.get('/resend-otp',userController.resendOtp)
router.get("/otpVerify",userController.loadFFOtpPage)
router.post('/otpVerify',userController.otpVerify)
router.get('/newPassword',userController.loadPasswordPage)
router.post('/changePassword',userController.changePassword)

router.get("/auth/google",passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signin'}),(req,res)=>{
    res.redirect('/');
})



router.get("/shop",shopController.loadShopPage);

module.exports = router;