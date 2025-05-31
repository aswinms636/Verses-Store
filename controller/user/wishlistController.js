const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");



const getWishlist = async (req, res) => {
    try {
        console.log("Fetching wishlist...");

        // Check if user is authenticated 
        if (!req.session.user) {
            return res.redirect('/signin');
        }

        const userId = req.session.user._id;
        console.log("User ID:", userId);

        // Find the user's wishlist and populate the product details inside `items`
        const wishlist = await Wishlist.findOne({ userId }).populate('items.productId');

        console.log("Wishlist Data:", wishlist);

        // Pass both wishlist and user data to the template
        res.render('wishlist', { 
            wishlist,
            user: req.session.user
        });

    } catch (error) {
        console.error("Error fetching wishlist:", error);
        
        // Render the wishlist page with error state
        res.render('wishlist', {
            wishlist: null,
            user: req.session.user,
            error: "Failed to load wishlist. Please try again later."
        });
    }
};




const addToWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user._id;

        console.log("User ID:", userId);

        if (!userId) return res.status(401).json({ message: "User not authenticated" });

        // Check if the product exists
        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ message: "Product not found" });

        // Find or create the wishlist for the user
        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({ userId, items: [] });
        }

        // Check if the product is already in the wishlist
        const existingItem = wishlist.items.find(item => item.productId.equals(productId));

        if (existingItem) {
            return res.status(400).json({ message: "Product is already in the wishlist" });

            
        }

        // Add the product to the wishlist
        wishlist.items.push({ productId, userId });
        await wishlist.save();
        res.json({ 
            success: true,
            message: "Product added to wishlist successfully" 
        });

    } catch (error) {
        console.error("Error adding to wishlist:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to add product to wishlist" 
        });
    }
};



 const removeFromWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user._id; // Assuming you have user authentication middleware

        // Find the wishlist for the user
        const wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            return res.status(404).json({ message: 'Wishlist not found' });
        }

        // Remove the item from the wishlist
        wishlist.items = wishlist.items.filter(item => item.productId.toString() !== productId);

        // Save the updated wishlist
        await wishlist.save();

        res.json({ success : true,message: 'Item removed from wishlist', wishlist });
    } catch (error) {
        console.error(error);
        res.json({ success : false, message: 'Server error' });
    }
};


module.exports = {
    addToWishlist,
    getWishlist,
    removeFromWishlist      
};