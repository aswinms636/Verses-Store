const Wallet = require('../../models/walletSchema'); 
const razorpay=require('razorpay');
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



 

const createOrder = async (req, res) => {
  const { amount } = req.body;

  try {
    const options = {
      key: process.env.RAZORPAY_KEY_ID, // Enter the Key ID generated from the Dashboard
      amount: amount * 100, // amount in paise
      currency: 'INR',
      receipt: 'receipt_order_' + Date.now(),
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};




// Adjust the path as necessary



const verifyPaymentAndUpdateWallet = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, amount, description } = req.body;

   const generatedSignature = crypto
              .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
              .update(razorpay_order_id + "|" + razorpay_payment_id)
              .digest("hex");

  if (generated_signature !== razorpay_signature) {
    return res.status(400).json({ message: 'Payment verification failed' });
  }

  try {
    let wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      const newWallet = new Wallet({
        user: userId,
        balance: 0,
        history: [],
      });
      wallet = await newWallet.save();
    }

    wallet.balance += amount;

    wallet.history.push({
      amount: amount,
      status: 'credit',
      description: description || 'Money added to wallet via Razorpay',
    });

    await wallet.save();

    res.status(200).json({ message: 'Money added to wallet successfully', wallet });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};






module.exports = {
    getWallet,
    createOrder,
    verifyPaymentAndUpdateWallet
};
