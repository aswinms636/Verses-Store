const express = require('express');
const router = express.Router();
const userController = require('../controller/user/userContoller'); 
// const { isLogin }=require('../middlewares/userAuthentic')



router.get("/",userController.loadHome);

module.exports = router;