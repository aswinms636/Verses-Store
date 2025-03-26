const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");

const loadShopPage = async (req, res) => {
    try {
        const sortOption = req.query.sort || 'default';
        let sortQuery = {};

        // Define sort queries
        switch (sortOption) {
            case 'priceAsc':
                sortQuery = { salePrice: 1 };
                break;
            case 'priceDesc':
                sortQuery = { salePrice: -1 };
                break;
            case 'nameAsc':
                sortQuery = { productName: 1 };
                break;
            case 'nameDesc':
                sortQuery = { productName: -1 };
                break;
            default:
                sortQuery = { createdAt: -1 }; // Default sort by newest
        }

        // Get products with sorting
        const products = await Product.find({ isBlocked: false })
            .sort(sortQuery)
            .populate('category');

        // Render page with sorted products
        res.render('shop', {
            products,
            currentSort: sortOption,
            user: req.session.user
        });

    } catch (error) {
        console.error('Shop page error:', error);
        res.status(500).render('shop', {
            error: 'Failed to load products',
            products: [],
            currentSort: 'default',
            user: req.session.user
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