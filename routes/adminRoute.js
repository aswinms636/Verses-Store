
const express = require('express');
const router = express.Router();
const adminController = require('../controller/admin/adminController');



router.get('/login',adminController.loadlogin)
router.post('/adminLogin',adminController.adminLogin)
router.get('/dashboard',adminController.loadDashboard)
router.post('/logout',adminController.logout)



module.exports = router;