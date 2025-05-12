

const User=require('../../models/userSchema')

const loadReferEarn = async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id)
            .populate('redeemedUsers');
        res.render('refer-earn', { user });
    } catch (error) {
        console.error('Error loading refer & earn page:', error);
        res.status(500).send('Server error');
    }
};

module.exports = {
    loadReferEarn
};