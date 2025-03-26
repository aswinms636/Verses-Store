
const express = require('express');
const router = express.Router();
const adminController = require('../controller/admin/adminController');
const customerController = require('../controller/admin/customerController');



router.get('/login',adminController.loadlogin)
router.post('/adminLogin',adminController.adminLogin)
router.get('/dashboard',adminController.loadDashboard)
router.post('/logout',adminController.logout)


router.get('/blockCustomer', adminController.blockUser);
router.get('/unblockCustomer', adminController.unblockUser);
router.get('/users',customerController.custermerInfo);


module.exports = router;