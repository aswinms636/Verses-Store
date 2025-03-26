const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");

const loadShopPage = async (req, res) => {
    try {
        const user = req.session.user;
        
        // Get all active categories
        const categories = await Category.find({ isListed: true });
        
        // Get all available products
        const products = await Product.find({ 
            isBlocked: false,
            status: "Available"
        }).populate('category');

        console.log("Found products:", products.length); // Debug log

        // Render the shop page
        res.render('shop', {
            user,
            categories,
            products,
            title: 'Shop'
        });

    } catch (error) {
        console.error("Shop page error:", error);
        res.status(500).render('shop', {
            user: req.session.user,
            categories: [],
            products: [],
            error: "Failed to load products"
        });
    }
};





const loadProductDetails = async (req, res) => {    
    try {
        const user = req.session.user
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category');
        
        if (!product) {
            return res.status(404).render('productDetails', {
                user,
                error: "Product not found"
            });
        }

        res.render('singleProduct', {
            user,
            product,
            title: product.name
        });

    } catch (error) {
        console.error("Product details error:", error);
        res.status(500).render('productDetails', {
            user: req.session.user,
            error: "Failed to load product details"
        });
    }
}

module.exports = {
    loadShopPage,
    loadProductDetails,
};