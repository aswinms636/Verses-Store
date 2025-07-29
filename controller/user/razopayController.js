const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const Coupon = require('../../models/coupenSchema');


const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const createOrder = async (req, res) => {
    try {
        const { totalAmount, addressId, couponCode, actualPrice, payableAmount, taxAmount, gstAmount, subTotal } = req.body;
        const userId = req.session.user._id;

        // Validate required fields and calculations
        if (!totalAmount || !actualPrice || !payableAmount || !subTotal || !addressId) {
            return res.status(400).json({
                success: false,
                message: "Missing required payment information or address"
            });
        }

        // Validate tax calculations
        const expectedTaxAmount = parseFloat((subTotal * 0.02).toFixed(2));
        const expectedGstAmount = parseFloat((subTotal * 0.02).toFixed(2));
        const expectedActualPrice = parseFloat((subTotal + expectedTaxAmount + expectedGstAmount).toFixed(2));

        // Validate calculations with small tolerance for floating-point arithmetic
        const tolerance = 0.01;
        if (Math.abs(taxAmount - expectedTaxAmount) > tolerance ||
            Math.abs(gstAmount - expectedGstAmount) > tolerance ||
            Math.abs(actualPrice - expectedActualPrice) > tolerance) {
            return res.status(400).json({
                success: false,
                message: "Invalid price calculations"
            });
        }

        // Get cart items
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Cart is empty" 
            });
        }

        // Validate address
        const address = await Address.findOne({ userId });
        if (!address) {
            return res.status(400).json({
                success: false,
                message: "No addresses found for user"
            });
        }

        // Find the specific address in the address array
        const selectedAddress = address.address.find(addr => addr._id.toString() === addressId);
        if (!selectedAddress) {
            return res.status(400).json({
                success: false,
                message: "Invalid address selected"
            });
        }

        // Only create Razorpay order, not DB order yet
        try {
            const razorpayOrder = await razorpay.orders.create({
                amount: Math.round(payableAmount * 100),
                currency: "INR",
                receipt: `order_${Date.now()}`,
                payment_capture: 1
            });

            if (!razorpayOrder || !razorpayOrder.id) {
                throw new Error("Failed to create Razorpay order");
            }

            res.json({
                success: true,
                orderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                key: process.env.RAZORPAY_KEY_ID,
                // Optionally, send back cart/order info for later use
            });

        } catch (razorpayError) {
            console.error("Razorpay Error:", razorpayError);
            return res.status(500).json({
                success: false,
                message: "Failed to create payment order"
            });
        }

    } catch (error) {
        console.error("Error Creating Order:", error);
        res.status(500).json({ 
            success: false, 
            message: error.message || "Order creation failed" 
        });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature,
            addressId,
            couponCode,
            subTotal,
            taxAmount,
            gstAmount,
            actualPrice,
            payableAmount,
            totalAmount
        } = req.body;
        const userId = req.session.user._id;

        // Verify signature
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment signature"
            });
        }

        // Get cart items
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) { 
            return res.status(400).json({ 
                success: false, 
                message: "Cart is empty" 
            });
        }

        // Validate address
        const address = await Address.findOne({ userId });
        if (!address) {
            return res.status(400).json({
                success: false,
                message: "No addresses found for user"
            });
        }
        const selectedAddress = address.address.find(addr => addr._id.toString() === addressId);
        if (!selectedAddress) {
            return res.status(400).json({
                success: false,
                message: "Invalid address selected"
            });
        }

  
        
        let couponObjectId = null;
        let couponDiscount = 0;
        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode });
            if (coupon) {
                couponObjectId = coupon._id;
                couponDiscount = coupon.offerPrice;
            }
        }

        // Create order in database according to orderSchema
        const order = new Order({
            userId,
            orderItems: cart.items.map(item => ({
                product: item.productId._id,
                size: item.size,
                quantity: item.quantity,
                price: item.price,
                status: 'Pending'
            })),
            totalPrice: totalAmount,
            totalAmount: payableAmount,
            paymentMethod: "Online Payment",
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            paymentStatus: "Paid",
            address: selectedAddress._id,
            status: "Pending",
            actualPrice: actualPrice,
            payableAmount: payableAmount,
            couponApplied: couponObjectId,
            couponDiscount: couponDiscount,
            taxAmount: taxAmount,
            gstAmount: gstAmount,
            subTotal: subTotal,
            invoiceDate: new Date()
        });

        await order.save();

        await Cart.findOneAndUpdate(
            { userId },
            { $set: { items: [] } }
        );

        res.json({
            success: true,
            message: "Payment verified and order placed successfully",
            orderId: order._id 
        });

    } catch (error) {
        console.error("Payment Verification Error:", error);
        res.status(500).json({ 
            success: false, 
            message: error.message || "Payment verification failed" 
        });
    }
};







module.exports = {
    createOrder,
    verifyPayment
};