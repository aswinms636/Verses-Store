const User = require('../../models/userSchema');


const loadHome = async (req, res) => {
    try {
        res.render("home")

    } catch (error) {
        console.error('Home page not found:', error);
        res.status(500).send('Server error');
    }
};


module.exports={
    loadHome
}




