const Wallet = require('../../models/walletSchema'); 

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

module.exports = {
    getWallet
};
