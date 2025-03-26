
const express = require('express');
const router = express.Router();
const adminController = require('../controller/admin/adminController');
const customerController = require('../controller/admin/customerController');
const categoryController = require('../controller/admin/categoryController');



router.get('/login',adminController.loadlogin)
router.post('/adminLogin',adminController.adminLogin)
router.get('/dashboard',adminController.loadDashboard)
router.post('/logout',adminController.logout)


router.get('/blockCustomer', adminController.blockUser);
router.get('/unblockCustomer', adminController.unblockUser);
router.get('/users',customerController.custermerInfo);



router.get('/category',categoryController.categoryInfo)
router.post('/addCategory',categoryController.addCategory)
router.post('/addCategoryOffer',categoryController.addCategoryOffer)
router.post('/removeCategoryOffer',categoryController.removeCategoryOffer)
router.post('/listCategory',categoryController.listCategory);
router.post('/unlistCategory',categoryController.unlistCategory);
router.get('/editCategory/:id',categoryController.loadEditCategory)
router.post('/editCategory/:id',categoryController.editCategory)

module.exports = router;