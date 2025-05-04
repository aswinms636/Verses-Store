const Wallet = require('../../models/walletSchema'); 
const Razorpay = require('razorpay');
const mongoose = require('mongoose');
const crypto = require('crypto');

const getWallet = async (req, res) => {
    try {
        const userId = req.session.user._id;

        let wallet = await Wallet.findOne({ user: userId }).populate('user', 'name email');
        console.log("Wallet Data:", wallet);

        if (!wallet) {
            wallet = new Wallet({
                user: userId,
                balance: 0,
                history: []
            });

            await wallet.save();
            console.log("New Wallet Created:", wallet);
        }

        // Pass the entire wallet object to the template
        res.render("myWallet", { wallet });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const addMoneyToWallet = async (req, res, next) => {
  try {
    console.log("Received request body:", req.body);
    const userId = req.session.user._id;
    if (!userId) {
      return res.status(400).json({ success: false, message: "User not logged in" });
    }
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    console.log("Razorpay instance created:", razorpay);
    const options = {
      amount: amount * 100, // amount in paise
      currency: "INR",
      receipt: `wallet_${userId.slice(0,6)}_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    console.log("Razorpay order created:", order);
    return res.json({ success: true, order,key: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    console.error("Error in addMoneyToWallet:", error);
    next(error);
  }
};

const walletPaymentSuccess = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    console.log("User ID:", userId);
    if (!userId) {
      return res.status(400).json({ success: false, message: "User not logged in" });
    }
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature, amount } = req.body;

    console.log("Payment success data:", req.body);

    // You can add payment signature verification logic here if needed.

    // Update the user's wallet.
    let userWallet = await Wallet.findOne({ user: userId });
    if (!userWallet) {
      userWallet = new Wallet({ user: userId, balance: 0, history: [] });
    }
    userWallet.balance += parseInt(amount);
    userWallet.history.push({
      amount: parseInt(amount),
      status: "credit",
      date: Date.now(),
      description: "Wallet recharge via Razorpay",
    });
    await userWallet.save();
    return res.json({ success: true, message: "Wallet updated successfully" });
  } catch (error) {
    console.error("Error in walletPaymentSuccess:", error);
    next(error);
  }
};


module.exports = {
    getWallet,
    addMoneyToWallet,
    walletPaymentSuccess,
};
