const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");

const loadShopPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 8; // Products per page
        const search = req.query.search || '';
        const sortOption = req.query.sort || 'default';
        const category = req.query.category;
        const minPrice = parseInt(req.query.minPrice) || 0;
        const maxPrice = parseInt(req.query.maxPrice) || Number.MAX_SAFE_INTEGER;
        
        // Build query
        let query = { isBlocked: false };
        
        // Add search filter
        if (search) {
            query.productName = { $regex: search, $options: 'i' };
        }
        
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

        // Get total count for pagination
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        // Get categories for filter
        const categories = await Category.find({ isListed: true });

        // Get products with pagination
        const products = await Product.find(query)
            .sort(sortQuery)
            .populate('category')
            .skip((page - 1) * limit)
            .limit(limit);

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

        // Add banner data
        const bannerInfo = {
            title: search ? `Search Results for "${search}"` : "Our Shop",
            subtitle: search ? `${totalProducts} products found` : "Browse our latest products",
            breadcrumbs: [
                { label: "Home", url: "/" },
                { label: "Shop", url: "/shop" },
                ...(search ? [{ label: `Search: ${search}`, url: "#" }] : [])
            ]
        };

        if (req.xhr) {
            return res.json({
                products,
                pagination: {
                    currentPage: page,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                },
                bannerInfo,
                totalProducts
            });
        }

        res.render('shop', {
            products,
            categories,
            currentSort: sortOption,
            selectedCategory: category,
            currentMinPrice: minPrice,
            currentMaxPrice: maxPrice,
            priceRange: priceRange[0] || { minPrice: 0, maxPrice: 10000 },
            user: req.session.user,
            pagination: {
                currentPage: page,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            },
            searchQuery: search,
            bannerInfo,
            totalProducts
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