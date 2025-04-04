const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");

const getDefaultPriceRange = async () => {
    try {
        const maxPriceResult = await Product.aggregate([
            { $match: { isBlocked: false } },
            { $group: { _id: null, maxPrice: { $max: '$salePrice' } } }
        ]);
        return {
            minPrice: 0,
            maxPrice: maxPriceResult[0]?.maxPrice || 10000
        };
    } catch (error) {
        console.error('Error getting price range:', error);
        return { minPrice: 0, maxPrice: 10000 };
    }
};

const loadShopPage = async (req, res) => {
    try {
        const sortOption = req.query.sort || 'default';
        const category = req.query.category;
        const minPrice = parseInt(req.query.minPrice) || 0;
        const maxPrice = parseInt(req.query.maxPrice) || Number.MAX_SAFE_INTEGER;
        
        // Build query
        let query = { isBlocked: false };
        
        // Add category filter
        if (category) {
            query.category = category;
        }
        
        // Add price filter
        query.salePrice = {
            $gte: minPrice,
            $lte: maxPrice
        };
        
        // Build sort query
        let sortQuery = {};
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
                sortQuery = { createdAt: -1 };
        }

        // Get categories for filter
        const categories = await Category.find({ isListed: true });

        // Get products with filters and sorting
        const products = await Product.find(query)
            .sort(sortQuery)
            .populate('category');

        // Get price range for filter
        const priceRange = await Product.aggregate([
            { $match: { isBlocked: false } },
            {
                $group: {
                    _id: null,
                    minPrice: { $min: '$salePrice' },
                    maxPrice: { $max: '$salePrice' }
                }
            }
        ]);

        res.render('shop', {
            products,
            categories,
            currentSort: sortOption,
            selectedCategory: category,
            currentMinPrice: minPrice,
            currentMaxPrice: maxPrice,
            priceRange: priceRange[0] || { minPrice: 0, maxPrice: 10000 },
            user: req.session.user
        });

    } catch (error) {
        console.error('Shop page error:', error);
        res.status(500).render('shop', {
            error: 'Failed to load products',
            products: [],
            categories: [],
            user: req.session.user
        });
    }
};

const loadProductDetails = async (req, res) => {    
    try {
        const user = req.session.user;
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
        res.status(500).render('productDetails',{
            user: req.session.user,
            error: "Failed to load product details"
        });
    }
}

module.exports = {
    loadShopPage,
    loadProductDetails,
    getDefaultPriceRange
};