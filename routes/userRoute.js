const express = require('express');
const router = express.Router();
const userController = require('../controller/user/userContoller'); 
const { isLogin,checkSession,blockCheck }=require('../middlewares/userAuthentic')
 const shopController=require('../controller/user/shopController');
 const profileController=require('../controller/user/profileController')
 const addressController=require('../controller/user/addressController')
 const cartController=require('../controller/user/cartController')
 const checkoutController=require('../controller/user/checkoutController')
 const orderController=require('../controller/user/orderController')
 const wishlistController=require('../controller/user/wishlistController')
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


router.get('/my-address', checkSession,addressController.getAddresses);
router.post('/add-address',addressController.addAddress);
router.post("/edit-address", addressController.editAddress);







router.post("/cart/add", cartController.addToCart);
router.post("/cart/increment", cartController.incrementCartItem);
router.post("/cart/decrement", cartController.decrementCartItem);
router.post("/cart/remove", cartController.decrementOrRemoveCartItem);
router.get("/cart", checkSession,cartController.getCart);





router.get("/checkout", checkoutController.getCheckoutPage);
router.post("/order/place", checkoutController.placeOrder);
router.post("/address/add",checkoutController.addAddress);
router.post("/place",checkoutController.placedOrder);
router.get("/order/view/:orderId",checkoutController.viewOrder);




router.get('/orders',checkSession,orderController.getUserOrders);
router.get('/order-details/:id',checkSession,orderController.viewOrderDetails);
router.post('/cancel-order/:id', orderController.cancelOrder);
router.post('/submit-return', orderController.submitReturnRequest);



router.get('/wishlist',wishlistController.getWishlist)
router.post('/wishlist-add',wishlistController.addToWishlist);




module.exports = router;