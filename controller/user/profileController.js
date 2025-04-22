
const User=require('../../models/userSchema');


const loadProfilePage= (req, res) => {
    try {
        const user = req.session.user;

        console.log("user_____________",user)
        if (!user) {
            return res.redirect("/signin",{message:"Please login to view your profile"});
        }
        res.render("profile", { user });
    } catch (error) {
        console.error("Error loading profile page:", error);
        res.redirect("/pageNotfound");
    }
}



const editProfile = async (req, res) => {
    try {
        const userId = req.session.user._id; // Assuming you have user authentication middleware
        const { name, email, phone } = req.body;

        console.log('1')

        // Find the user by ID and update the fields
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { name, email, phone },
            { new: true, runValidators: true }
        );

        console.log('2',updatedUser)

        if (!updatedUser) {
            return res.json({ success:false, message: 'User not found' });
        }

        console.log("3");
        
        // Send a success response
        res.status(200).json({ success:true, message: 'Profile updated successfully', user: updatedUser });
    } catch (error) {
        console.error(error);
        res.json({ success:false, message: 'Internal Server Error' });
    }
};






module.exports = {  
    loadProfilePage,
    editProfile
   
};