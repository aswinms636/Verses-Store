const express = require('express');
const router = express.Router();
const userController = require('../controller/user/userContoller'); 
// const { isLogin }=require('../middlewares/userAuthentic')



router.get("/",userController.loadHome);
router.get("/signup",userController.loadSingnup)
router.get("/signin",userController.loadsignin);
router.post("/signup",userController.signup);
router.get("/verifyOtp",userController.loadOtpPage);
router.post("/verifyOtp",userController.verifyOtp);


module.exports = router;