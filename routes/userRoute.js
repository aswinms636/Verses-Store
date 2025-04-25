const express = require('express');
const router = express.Router();
const userController = require('../controller/user/userContoller'); 
const { isLogin,checkSession,blockCheck }=require('../middlewares/userAuthentic')
 const shopController=require('../controller/user/shopController');
 const profileController=require('../controller/user/profileController')
 const addressController=require('../controller/user/addressController')
const passport=require('../config/passport')


//Authentication

router.get("/",blockCheck,userController.loadHome);
router.get("/signup",isLogin,userController.loadSingnup)
router.get("/signin",isLogin,userController.loadsignin);
router.post("/signin",userController.signin);
router.post("/signup",userController.signup);
router.get("/verifyOtp",isLogin,userController.loadOtpPage);
router.post("/verifyOtp",userController.verifyOtp);
router.get("/logout",userController.logout);
router.get("/pageNotFound",userController.loadPageNotFound);


//Forgot Password
router.post('/verifyEmail',userController.verifyEmail)
router.get('/forgot-Password',userController.loadForgotPasswordPage);
router.get('/resend-otp',userController.resendOtp)
router.get("/otpVerify",userController.loadFFOtpPage)
router.post('/otpVerify',userController.otpVerify)
router.get('/newPassword',userController.loadPasswordPage)
router.post('/changePassword',userController.changePassword)


//google Signin
router.get("/auth/google",passport.authenticate('google',{scope:['profile','email']}));
router.get("/google/callback", passport.authenticate('google', { failureRedirect: '/signin' }), 
    (req, res) => {
        if (req.user) {
            req.session.user = req.user 
        }
        res.redirect('/');
    }
);


//sz
router.get("/shop",shopController.loadShopPage);
router.get('/productDetails/:id',shopController.loadProductDetails);



router.get('/profile',checkSession,profileController.loadProfilePage);
router.post('/edit-profile',profileController.editProfile);


router.get('/myAddress',checkSession,addressController.loadAddresses);
router.post('/addAddress',addressController.addAddress)
router.post('/editAddress',addressController.updateAddress)

module.exports = router;