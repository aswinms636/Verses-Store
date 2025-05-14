const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');

const loadReferEarn = async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id)
            .populate('redeemedUsers');
        
        const wallet = await Wallet.findOne({ user: req.session.user._id });
        
        // If wallet doesn't exist, create one
        if (!wallet) {
            const newWallet = new Wallet({
                user: req.session.user._id,
                balance: 0,
                history: []
            });
            await newWallet.save();
           return res.render('refer-earn', { user, wallet: newWallet });
        } else {
          return  res.render('refer-earn', { user, wallet });
        }
    } catch (error) {
        console.error('Error loading refer & earn page:', error);
        res.status(500).send('Server error');
    }
};

module.exports = {
    loadReferEarn
};