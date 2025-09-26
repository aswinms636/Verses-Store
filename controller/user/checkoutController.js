const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const Wallet = require('../../models/walletSchema');
const Coupon = require('../../models/coupenSchema');
const mongoose = require('mongoose');




const getCheckoutPage = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect("/signin"); 
        }

        const userId = req.session.user._id;
        const cart = await Cart.findOne({ userId }).populate("items.productId");

        // Check if cart exists and has items
        if (!cart || !cart.items.length) {
            return res.redirect("/cart");
        }
        
        // Verify stock for each item
        for (const item of cart.items) {
            const product = await Product.findOne({ _id: item.productId._id });
            
            if (!product) {
                return res.status(400).json({
                    success: false,
                    message: `Product not found`
                });
            }

            // Check size availability from the sizes object
            const sizeStock = product.sizes[item.size];

            if (typeof sizeStock === 'undefined' || sizeStock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for product ${product.productName}, size ${item.size}. Available: ${sizeStock || 0}`,
                });
            }
        }
       
        const userAddressDoc = await Address.findOne({ userId });

        let cartItems = [];
        let totalAmount = 0;
        let userAddresses = userAddressDoc ? userAddressDoc.address : [];

        if (cart && cart.items.length > 0) {
            cartItems = cart.items.map(item => ({
                productId: item.productId._id,
                productName: item.productId.productName,
                size: item.size,
                quantity: item.quantity,
                price: item.price,
                image: item.productId.productImage?.length > 0 ? item.productId.productImage[0] : "/default-image.jpg",
                totalPrice: item.quantity * item.price
            }));
            
            totalAmount = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
        }

        // Check the request's Accept header to determine the response type
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({
                success: true, 
                message: "Checkout page loaded successfully"
            });
        }

        return res.render("checkout", {
            cartItems,
            userAddresses,
            totalAmount
        });
    } catch (error) {
        console.error("Error in getCheckoutPage:", error);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ 
                success: false, 
                message: "Server error" 
            });
        }
        return res.status(500).send("Server error");
    }
};





const placeOrder = async (req, res) => {
    try {
        const { addressId, payment } = req.body;
        const userId = req.session.user._id;

        if (!addressId || !payment) return res.status(400).json({ success: false, message: "Select an address and payment method" });

        const cartItems = await Cart.find({ userId });

        const order = new Order({
            userId,
            items: cartItems.map(item => ({
                productId: item.productId,
                size: item.size,
                quantity: item.quantity,
                price: item.productId.price
            })),
            totalAmount: cartItems.reduce((sum, item) => sum + item.productId.price * item.quantity, 0) + 5,
            shippingAddress: addressId,
            paymentMethod: payment,
            status: "Pending"
        });

        await order.save();
        await Cart.deleteMany({ userId });

        res.json({ success: true, message: "Order placed successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};




const addAddress = async (req, res) => {
    try {
        const userId = req.session.user._id;

        console.log(userId);
        

        const { fullname, phone, street, city, landmark, state, zipCode } = req.body;

        const errors = {};
        if (!fullname || fullname.trim() === '') errors.fullname = "Full name is required.";
        if (!phone || phone.trim() === '') errors.phone = "Phone number is required.";
        if (!street || street.trim() === '') errors.street = "Street is required.";
        if (!city || city.trim() === '') errors.city = "City is required.";
        if (!landmark || landmark.trim() === '') errors.landmark = "Landmark is required.";
        if (!state || state.trim() === '') errors.state = "State is required.";
        if (!zipCode || zipCode.trim() === '') errors.zipCode = "Zip Code is required.";

       
        if (Object.keys(errors).length > 0) {
            return res.json({ success: false, errors });
        }

        const newAddressObj = {
            fullname,
            phone,
            street,
            city,
            landmark,
            state,
            zipCode,
        };

        let userAddress = await Address.findOne({ userId });

        console.log("userAddress",userAddress);
        

        if (userAddress) {
            await Address.updateOne(
                { userId },
                { $push: { address: { $each: [newAddressObj], $position: 0 } } }
            );
        } else {
            await Address.create({
                userId,
                address: [newAddressObj],
            });
        }

        
        userAddress = await Address.findOne({ userId });
        const updatedAddresses = userAddress.address;

        console.log("haiiiiiiiiiiiiiiiiii",updatedAddresses);
        

        return res.json({ success: true, addresses: updatedAddresses });

    } catch (error) {
        console.error("Error adding address:", error);
        return res.json({ success: false, message: "Internal server error" });
    }
};


const placedOrder = async (req, res) => {
    try {
        const { addressId, paymentMethod, couponCode, actualPrice, payableAmount, taxAmount, gstAmount, subTotal } = req.body;
        const userId = req.session.user._id;

        // Validate address
        const addressDoc = await Address.findOne({ 
            userId: userId, 
            "address._id": addressId 
        });

        if (!addressDoc || !addressDoc.address.find(addr => addr._id.toString() === addressId)) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid address selected" 
            });
        }

        const selectedAddress = addressDoc.address.find(addr => addr._id.toString() === addressId);

        // Add validation for subtotal and related amounts
        if (!subTotal || subTotal <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid subtotal amount" 
            });
        }

        // Validate tax and GST calculations
        const expectedTaxAmount = parseFloat((subTotal * 0.02).toFixed(2));
        const expectedGstAmount = parseFloat((subTotal * 0.02).toFixed(2));
        const expectedActualPrice = parseFloat((subTotal + expectedTaxAmount + expectedGstAmount).toFixed(2));

        if (Math.abs(taxAmount - expectedTaxAmount) > 0.01 || 
            Math.abs(gstAmount - expectedGstAmount) > 0.01 || 
            Math.abs(actualPrice - expectedActualPrice) > 0.01) {
            return res.status(400).json({
                success: false,
                message: "Invalid price calculations detected"
            });
        }

        // Validate final payable amount
        let expectedPayableAmount = expectedActualPrice;
        if (couponCode) {
            const coupon = await Coupon.findOne({ name: couponCode });
            if (coupon) {
                expectedPayableAmount -= coupon.offerPrice;
            }
        }

        if (Math.abs(payableAmount - expectedPayableAmount) > 0.01) {
            return res.status(400).json({
                success: false,
                message: "Invalid final amount calculation"
            });
        }

        // Get cart with populated product details
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || !cart.items.length) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        // Validate stock for all items before processing
        for (const item of cart.items) {
            const product = item.productId;
            const selectedSize = item.size;
            const orderedQty = item.quantity;

            // Check stock availability
            const currentProduct = await Product.findById(product._id);
            if (!currentProduct.sizes || 
                !currentProduct.sizes[selectedSize] || 
                currentProduct.sizes[selectedSize] < orderedQty) {
                return res.json({
                    success: false,
                    message: `Not enough stock for size ${selectedSize} of product ${product.productName}`
                });
            }
        }

        // Process orders
        const placedOrders = [];
        let totalAmount = 0;

        try {
            // Handle wallet payment first if selected
            if (paymentMethod === 'Wallet Payment') {
                const wallet = await Wallet.findOne({ user: userId });
                const cartTotal = cart.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                
                if (!wallet || wallet.balance < cartTotal) {
                    return res.status(400).json({
                        success: false,
                        message: 'Insufficient wallet balance'
                    });
                }
            }

            // Process each item
            for (const item of cart.items) {
                const product = item.productId;
                const selectedSize = item.size;
                
                
                const updateResult = await Product.findOneAndUpdate(
                    {
                        _id: product._id,
                        [`sizes.${selectedSize}`]: { $gte: item.quantity }
                    },
                    {
                        $inc: {
                            [`sizes.${selectedSize}`]: -item.quantity,
                            quantity: -item.quantity
                        }
                    },
                    { new: true }
                );

                if (!updateResult) {
                    throw new Error(`Failed to update inventory for product ${product.productName}`);
                }

                const totalPrice = payableAmount 
                totalAmount += totalPrice;

                // Create order
                const orderData = {
                    userId,
                    orderItems: [{
                        product: product._id,
                        size: selectedSize,
                        quantity: item.quantity,
                        price: item.price
                    }],
                    subTotal: subTotal,
                    taxAmount: taxAmount,
                    gstAmount: gstAmount,
                    totalPrice: totalPrice,
                    totalAmount: totalPrice,
                    paymentMethod,
                    address: addressId, // Store the address ID instead of the address object
                    status: "Pending",
                    actualPrice,
                    payableAmount,
                    couponApplied: null,
                    couponDiscount: 0
                };

                if (couponCode) {
                    const coupon = await Coupon.findOne({ name: couponCode });
                    if (coupon) {
                        orderData.couponApplied = coupon._id;
                        orderData.couponDiscount = coupon.offerPrice;
                    }
                }

                const newOrder = new Order(orderData);
                await newOrder.save();
                placedOrders.push(newOrder);
            }

            // Update wallet balance if wallet payment
            if (paymentMethod === 'Wallet Payment') {
                const wallet = await Wallet.findOne({ user: userId });
                if (!wallet) {
                    return res.json({ success: false, message: 'Wallet not found' });
                }
                wallet.balance -= totalAmount;
                wallet.history.push({
                    amount: totalAmount,
                    status: 'debit',
                    description: `payment for order ${placedOrders.map(order => order._id).join(', ')}`,
                    date: new Date()
                });
                await wallet.save();
            }

            // Clear cart after successful order placement
            await Cart.findOneAndUpdate(
                { userId },
                { $set: { items: [] } }
            );

            return res.json({ 
                success: true, 
                orders: placedOrders.map(order => order._id)
            });

        } catch (error) {
            // If any error occurs, we should log it and return a failure response
            console.error("Order processing error:", error);
            return res.status(500).json({ 
                success: false, 
                message: error.message || "Failed to process order"
            });
        }

    } catch (error) {
        console.error("Order placement error:", error);
        return res.status(500).json({ 
            success: false, 
            message: error.message || "Order placement failed" 
        });
    }
};






const viewOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        
        const order = await Order.findById(orderId)
            .populate({
                path: 'orderItems.product',
                select: 'productName productImage price'
            })
            .populate('userId', 'name email')
            .exec();

        if (!order) {
            return res.render('orderdetails', { 
                order: null,
                error: 'Order not found'
            });
        }

        const formattedOrder = {
            orderId: order.orderId,
            status: order.status,
            createdOn: order.createdOn,
            address: order.address,
            paymentMethod: order.paymentMethod,
            totalAmount: order.totalAmount,
            orderItems: order.orderItems.map(item => ({
                product: {
                    name: item.product?.productName || 'Product Unavailable',
                    image: item.product?.productImage?.[0] || '/default-product.jpg'
                },
                size: item.size,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.quantity * item.price
            }))
        };

        console.log('Formatted Order:', formattedOrder);

        res.render('orderDetails', {
            order: formattedOrder,
            error: null
        });

    } catch (error) {
        console.error('Error in viewOrder:', error);
        res.render('orderdetails', {
            order: null,
            error: 'Error loading order details'
        });
    }
};




const getAvailableCoupons = async (req, res) => {
    try {

        console.log('Received request for available coupons'); 
        const totalAmount = parseFloat(req.params.id);
        const userId = req.session.user._id;
        const currentDate = new Date();

        console.log('Received request for coupons:', { totalAmount, userId }); 

        // Validate inputs
        if (isNaN(totalAmount) || totalAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid total amount'
            });
        }

        // Fetch all valid coupons
        const allCoupons = await Coupon.find({
            isList: true,
            minimumPrice: { $lte: totalAmount },
            expireOn: { $gt: currentDate }
        });

        console.log('Found coupons:', allCoupons); 

        // Separate coupons into used and available
        const usedCoupons = allCoupons.filter(coupon => 
            coupon.userId.includes(userId)
        );
        
        const availableCoupons = allCoupons.filter(coupon => 
            !coupon.userId.includes(userId)
        );

        console.log('Separated coupons:', { 
            available: availableCoupons.length, 
            used: usedCoupons.length 
        }); // Debug log

        res.json({
            success: true,
            availableCoupons: availableCoupons.map(coupon => ({
                name: coupon.name,
                offerPrice: coupon.offerPrice,
                minimumPrice: coupon.minimumPrice,
                expireOn: coupon.expireOn
            })),
            usedCoupons: usedCoupons.map(coupon => ({
                name: coupon.name,
                offerPrice: coupon.offerPrice,
                minimumPrice: coupon.minimumPrice,
                expireOn: coupon.expireOn
            }))
        });

    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch coupons'
        });
    }
};

const applyCoupon = async (req, res) => {
    try {
        const { couponCode, totalAmount } = req.body;
        const userId = req.session.user._id;

        console.log('Applying coupon:', { couponCode, totalAmount, userId }); // Debug log

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        const coupon = await Coupon.findOne({
            name: couponCode,
            isList: true,
            minimumPrice: { $lte: totalAmount },
            expireOn: { $gt: new Date() }
        });

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired coupon'
            });
        }

        if (coupon.userId.includes(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Coupon already used'
            });
        }

        const discount = coupon.offerPrice;
        const newTotal = totalAmount - discount;

        // Add user to the coupon's used list
        await Coupon.findByIdAndUpdate(coupon._id, {
            $addToSet: { userId: userId }
        });

        console.log('Coupon applied successfully:', {
            discount,
            newTotal,
            couponId: coupon._id
        }); // Debug log

        res.json({
            success: true,
            
            message: 'Coupon applied successfully',
            discount: discount,
            newTotal: newTotal,
            couponDetails: {
                code: couponCode,
                discount: discount
            }
        });

    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to apply coupon'
        });
    }
};


const removeCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;
        const userId = req.session.user._id;

        const coupon = await Coupon.findOne({ name: couponCode });
        if (!coupon) {
            return res.json({
                success: false,
                message: 'Coupon not found'
            });
        }

        // Remove user from the coupon's used list
        await Coupon.findByIdAndUpdate(coupon._id, {
            $pull: { userId: userId }
        });

        res.json({
            success: true,
           
            message: 'Coupon removed successfully'
        });

    } catch (error) {
        console.error('Error removing coupon:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove coupon'
        });
    }
};




module.exports = {
    placeOrder,
    getCheckoutPage,
    addAddress,
    placedOrder,
    viewOrder,
    getAvailableCoupons,
    applyCoupon,
    removeCoupon
};