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
 const razorpayController=require('../controller/user/razopayController')
 const walletController=require('../controller/user/walletController')
 const referalController=require('../controller/user/referalController')

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
router.post('/resend-otp',userController.resendOtp)
router.get("/otpVerify",userController.loadFFOtpPage)
router.post('/otpVerify',userController.otpVerify)
router.get('/newPassword',userController.loadPasswordPage)
router.post('/changePassword',userController.changePassword)
router.post('/upload-profile-photo',  profileController.uploadProfilePhoto);
router.post('/remove-profile-photo',  profileController.removeProfilePhoto);


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


//shop manegement

router.get("/shop",shopController.loadShopPage);
router.get('/productDetails/:id',shopController.loadProductDetails);


// profile manegement

router.get('/profile',checkSession,profileController.loadProfilePage);
router.post('/edit-profile',profileController.editProfile);
router.post('/send-password-otp', profileController.sendPasswordOtp);
router.post('/verify-password-otp', profileController.verifyPasswordOtp);
router.post('/change-password', profileController.changePassword);

// address manegement

router.get('/my-address',checkSession,addressController.getAddresses);
router.post('/add-address',addressController.addAddress);
router.post("/edit-address", addressController.editAddress);
router.post("/delete-address", addressController.deleteAddress);








// cart manegement

router.post("/cart/add",checkSession, cartController.addToCart);
router.post("/cart/increment", cartController.incrementCartItem);
router.post("/cart/decrement", cartController.decrementCartItem);
router.post("/cart/remove", cartController.decrementOrRemoveCartItem);
router.get("/cart", checkSession,cartController.getCart);




// checkout manegement

router.get("/checkout", checkSession, checkoutController.getCheckoutPage);
router.post("/order/place", checkSession, checkoutController.placeOrder);
router.post("/address/add", checkSession, checkoutController.addAddress);
router.post("/place", checkSession, checkoutController.placedOrder);
router.get("/order/view/:orderId", checkSession, checkoutController.viewOrder);
router.get('/coupons/available/:id', checkSession, checkoutController.getAvailableCoupons); // Remove :id parameter
router.post('/coupons/apply', checkSession, checkoutController.applyCoupon);
router.post('/coupons/remove', checkSession, checkoutController.removeCoupon);



// order manegement

router.get('/orders',checkSession,orderController.getUserOrders);
router.get('/order-details/:id',checkSession,orderController.viewOrderDetails);
router.post('/submit-return', orderController.submitReturnRequest);
router.get('/download-invoice/:orderId', orderController.downloadInvoice);
router.post('/cancel-order/:id', checkSession, orderController.cancelOrder);


// wishlist manegement

router.get('/wishlist', checkSession,  wishlistController.getWishlist);
router.post('/wishlist-add', checkSession,wishlistController.addToWishlist);
router.post('/wishlist/remove',wishlistController.removeFromWishlist);


router.post('/create-order',checkSession,razorpayController.createOrder);
router.post('/verify-payment',checkSession,razorpayController.verifyPayment);
// Add this route for pending order creation
router.post('/retry-payment-init', checkSession, razorpayController.retryPaymentInit);
router.post('/complete-payment', checkSession, razorpayController.completePayment);

router.get('/wallet',checkSession, walletController.getWallet);
router.post('/addMoneyToWallet', walletController.addMoneyToWallet);
router.post('/walletPaymentSuccess',walletController.walletPaymentSuccess);

router.get('/refer-earn',checkSession,referalController.loadReferEarn);




module.exports = router;