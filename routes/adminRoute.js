const express = require('express');
const router = express.Router();
const adminController = require('../controller/admin/adminController');
const customerController = require('../controller/admin/customerController');
const categoryController = require('../controller/admin/categoryController');
const productController = require('../controller/admin/productController');
const orderController = require('../controller/admin/orderController');
const coupenController = require('../controller/admin/coupenController');
const { isLogin,checkSession }=require('../middlewares/adminAuthetic');
const upload= require('../middlewares/multer');



//Authentication manegement
router.get('/login',isLogin,adminController.loadlogin);
router.post('/adminLogin',adminController.adminLogin);
router.get('/dashboard',checkSession,adminController.loadDashboard);
router.get('/logout',adminController.logout);



//Users Management
router.get('/blockCustomer', checkSession,adminController.blockUser);
router.get('/unblockCustomer',checkSession, adminController.unblockUser);
router.post('/toggleUserStatus',checkSession,adminController.toggleUserStatus);
router.get('/users',checkSession,customerController.customerInfo);


//Category Management
router.get('/category',checkSession,categoryController.categoryInfo)
router.post('/addCategory',checkSession,categoryController.addCategory)
router.post('/addCategoryOffer',categoryController.addCategoryOffer)
router.post('/removeCategoryOffer',categoryController.removeCategoryOffer)
router.post('/listCategory',categoryController.listCategory);
router.post('/unlistCategory',categoryController.unlistCategory);
router.get('/editCategory/:id',checkSession,categoryController.loadEditCategory)
router.post('/editCategory/:id',categoryController.editCategory)




//Product Management
router.get('/addProducts',checkSession,productController.loadAddProduct);
router.post('/addProducts', upload.array('productImages', 4),productController.addProducts);
router.get('/products',checkSession,productController.getAllProducts);
router.post('/addProductOffer',productController.addProductOffer)
router.post("/removeProductOffer",productController.removeProductOffer)
router.get('/blockProduct',checkSession,productController.blockProduct)
router.get('/unblockProduct',checkSession,productController.unblockProduct)
router.get('/editProduct',checkSession,productController.loadEditProduct)
router.post('/editProduct/:id', upload.array('productImages', 4), productController.editProduct);
router.post('/deleteImage',checkSession,productController.deleteSingleImg);





// order manegement

router.get('/orders',checkSession,orderController.getAllOrders);
router.get('/order-details/:orderId',checkSession,orderController.getOrderDetails);
router.post('/orders/:orderId/update-status',orderController.updateOrderStatus);

// return order 

router.get('/returnOrders',checkSession,orderController.getReturnOrders);
router.post('/returns/accept/:orderId/:itemId', orderController.acceptReturn);
router.post('/returns/reject/:orderId/:itemId', orderController.rejectReturn);

router.get('/coupon',checkSession,coupenController.loadCoupon);
router.post('/createCoupon',coupenController.createCoupon);
router.patch("/coupon/:id/list", checkSession, coupenController.listCoupon); 
router.patch("/coupon/:id/unlist", checkSession, coupenController.unlistCoupon)
router.get('/editCoupon',checkSession,coupenController.loadEditCoupon)
router.post('/updatecoupon',coupenController.updateCoupon)




module.exports = router;