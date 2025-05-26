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
        if (!totalAmount || !actualPrice || !payableAmount || !subTotal) {
            return res.status(400).json({
                success: false,
                message: "Missing required payment information"
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

        // Validate address
        const addressDoc = await Address.findOne({
            userId: userId,
            'address._id': addressId
        });

        if (!addressDoc) {
            return res.status(400).json({
                success: false,
                message: "Address not found"
            });
        }

        const selectedAddress = addressDoc.address.find(
            addr => addr._id.toString() === addressId
        );

        // Get cart items
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Cart is empty" 
            });
        }

        try {
            // Create Razorpay order
            const razorpayOrder = await razorpay.orders.create({
                amount: Math.round(payableAmount * 100), // Convert to paise
                currency: "INR",
                receipt: `order_${Date.now()}`,
                payment_capture: 1
            });

            if (!razorpayOrder || !razorpayOrder.id) {
                throw new Error("Failed to create Razorpay order");
            }

            // Handle coupon if provided
            let couponObjectId = null;
            let couponDiscount = 0;
            if (couponCode) {
                const coupon = await Coupon.findOne({ code: couponCode });
                if (coupon) {
                    couponObjectId = coupon._id;
                    couponDiscount = coupon.offerPrice;
                }
            }

            // Create order in database with tax details
            const order = new Order({
                userId,
                orderItems: cart.items.map(item => ({
                    product: item.productId._id,
                    size: item.size,
                    quantity: item.quantity,
                    price: item.price
                })),
                totalPrice: totalAmount,
                totalAmount: payableAmount,
                paymentMethod: "Online Payment",
                razorpayOrderId: razorpayOrder.id,
                paymentStatus: "Pending",
                address: {
                    fullname: selectedAddress.fullname,
                    street: selectedAddress.street,
                    city: selectedAddress.city,
                    state: selectedAddress.state,
                    zipCode: selectedAddress.zipCode,
                    phone: selectedAddress.phone
                },
                status: "Pending",
                actualPrice: actualPrice,
                payableAmount: payableAmount,
                couponApplied: couponObjectId,
                couponDiscount: couponDiscount,
                taxAmount: taxAmount,
                gstAmount: gstAmount,
                subTotal: subTotal
            });

            await order.save();

            // Clear cart
            await Cart.findOneAndUpdate(
                { userId },
                { $set: { items: [] } }
            );

            res.json({
                success: true,
                orderId: razorpayOrder.id,
                dbOrderId: order._id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                key: process.env.RAZORPAY_KEY_ID
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
            dbOrderId 
        } = req.body;

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

        // Update order status
        const order = await Order.findById(dbOrderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        order.razorpayPaymentId = razorpay_payment_id;
        order.razorpaySignature = razorpay_signature;
        order.paymentStatus = "Paid";
        order.status = "Pending";
        order.invoiceDate = new Date();

        await order.save();

        res.json({
            success: true,
            message: "Payment verified successfully",
            orderId: dbOrderId
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