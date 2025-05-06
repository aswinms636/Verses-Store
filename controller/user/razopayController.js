const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const createOrder = async (req, res) => {
    try {
        const { totalAmount, addressId } = req.body;
        const userId = req.session.user._id;
        console.log("userId:", userId);

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

        if (!selectedAddress) {
            return res.status(400).json({
                success: false,
                message: "Selected address not found"
            });
        }

        const cart = await Cart.findOne({ userId }).populate({
            path: "items.productId",
            select: "name price images stock"
        });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        console.log("🛒 Cart Data:", cart);

        const options = {
            amount: totalAmount * 100,
            currency: "INR",
            receipt: "order_rcptid_" + Math.random().toString(36).substr(2, 9)
        };

        const razorpayOrder = await razorpay.orders.create(options);

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
            totalAmount,
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
            status: "Pending"
        });

        console.log("📦 New Order:", order);

        await order.save();

        console.log("✅ Order Created:", order);

        res.json({
            success: true,
            orderId: razorpayOrder.id,
            dbOrderId: order._id, // Include dbOrderId in the response
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key:process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error("❌ Error Creating Order:", error);
        res.status(500).json({ success: false, message: "Order creation failed" });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, dbOrderId } = req.body;

        console.log('req.body', req.body);

        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        console.log("Generated Signature:", generatedSignature);

        if (generatedSignature === razorpay_signature) {
            console.log("Signature Verified");
            const updatedOrder = await Order.findByIdAndUpdate(
                dbOrderId,
                {
                    razorpayPaymentId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature,
                    paymentStatus: "Paid",
                    invoiceDate: new Date(),
                    status: "Processing" // Update order status
                },
                { new: true }
            );

            res.json({
                success: true,
                message: "Payment verified successfully",
                orderId: razorpay_order_id
            });
        } else{
            console.log("Signature Verification Failed");
            res.json({
                success: false,
                message: "Payment verification failed"
            });
        }

        

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

module.exports = {
    createOrder,
    verifyPayment
};