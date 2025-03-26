const express = require('express');
const router = express.Router();
const adminController = require('../controller/admin/adminController');
const customerController = require('../controller/admin/customerController');
const categoryController = require('../controller/admin/categoryController');
const productController = require('../controller/admin/productController');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
   
    
    destination: (req, file, cb) => {
        cb(null, 'Uploads/'); 
    },
    filename: (req, file, cb) => {
        const namePrefix = Date.now();
        const ext = path.extname(file.originalname)
        const newName = namePrefix + ext; 
        cb(null, newName);
    }
 });

 const uploads = multer({ storage });

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

router.get('/addProducts',productController.loadAddProduct)
router.post('/addProducts',uploads.array('productImages',2),productController.addProducts)
router.get('/products',productController.getAllProducts);
router.post('/addProductOffer',productController.addProductOffer)
router.post("/removeProductOffer",productController.removeProductOffer)
router.get('/blockProduct',productController.blockProduct)
router.get('/unblockProduct',productController.unblockProduct)
router.get('/editProduct',productController.loadEditProduct)
router.post('/editProduct/:id', uploads.array('productImages', 2), productController.editProduct);

router.post('/deleteImage',productController.deleteSingleImg)

module.exports = router;