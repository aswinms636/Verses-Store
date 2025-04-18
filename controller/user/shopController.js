const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");

const getDefaultPriceRange = async () => {
    try {
        const maxPriceResult = await Product.aggregate([
            { $match: { isBlocked: false } },
            { $group: { _id: null, maxPrice: { $max: "$salePrice" } } },
        ]);
        return {
            minPrice: 0,
            maxPrice: maxPriceResult[0]?.maxPrice || 10000,
        };
    } catch (error) {
        console.error("Error getting price range:", error.message);
        return { minPrice: 0, maxPrice: 10000 };
    }
};

const loadShopPage = async (req, res) => {
    try {
        const sortOption = req.query.sort || "default";
        const category = req.query.category || "";
        const minPrice = Math.max(0, parseInt(req.query.minPrice) || 0); // Prevent negative prices
        const maxPrice = parseInt(req.query.maxPrice) || Number.MAX_SAFE_INTEGER;
        const searchQuery = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 12; // Number of products per page

        // Build query
        let query = { isBlocked: false };

        // Add search filter
        if (searchQuery) {
            query.$or = [
                { productName: { $regex: searchQuery, $options: "i" } },
                { description: { $regex: searchQuery, $options: "i" } },
            ];
        }

        // Add category filter with validation
        if (category) {
            const categoryExists = await Category.findById(category);
            if (categoryExists && categoryExists.isListed) {
                query.category = category;
            } else {
                query.category = null; // Invalid category, no results
            }
        }

        // Add price filter
        query.salePrice = {
            $gte: minPrice,
            $lte: Math.min(maxPrice, Number.MAX_SAFE_INTEGER), // Cap max price
        };

        // Build sort query
        let sortQuery = {};
        switch (sortOption) {
            case "priceAsc":
                sortQuery = { salePrice: 1 };
                break;
            case "priceDesc":
                sortQuery = { salePrice: -1 };
                break;
            case "nameAsc":
                sortQuery = { productName: 1 };
                break;
            case "nameDesc":
                sortQuery = { productName: -1 };
                break;
            default:
                sortQuery = { createdAt: -1 };
        }

        // Fetch categories for filter
        const categories = await Category.find({ isListed: true });

        // Fetch products with filters, sorting, and pagination
        const products = await Product.find(query)
            .sort(sortQuery)
            .skip((page - 1) * limit)
            .limit(limit)
            .populate("category", "name"); // Only populate necessary fields

        // Get total count of products for pagination
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        // Get price range for filter (reuse getDefaultPriceRange)
        const priceRange = await getDefaultPriceRange();

        res.render("shop", {
            products,
            categories,
            currentSort: sortOption,
            selectedCategory: category,
            currentMinPrice: minPrice,
            currentMaxPrice: maxPrice === Number.MAX_SAFE_INTEGER ? priceRange.maxPrice : maxPrice,
            priceRange,
            searchQuery,
            user: req.session.user,
            error: null,
            currentPage: page,
            totalPages,
        });
    } catch (error) {
        console.error("Shop page error:", error.message);
        res.status(500).render("shop", {
            error: "An unexpected error occurred while loading the shop page.",
            products: [],
            categories: [],
            currentSort: "default",
            selectedCategory: "",
            currentMinPrice: 0,
            currentMaxPrice: 10000,
            priceRange: { minPrice: 0, maxPrice: 10000 },
            searchQuery: "",
            user: req.session.user,
            currentPage: 1,
            totalPages: 1,
        });
    }
};

const loadProductDetails = async (req, res) => {
    try {
        const user = req.session.user;
        const productId = req.params.id;
        const product = await Product.findById(productId).populate("category", "name");

        if (!product || product.isBlocked) {
            return res.status(404).render("productDetails", {
                user,
                error: "Product not found or unavailable",
            });
        }

        res.render("singleProduct", {
            user,
            product,
            title: product.productName, // Use productName for consistency
        });
    } catch (error) {
        console.error("Product details error:", error.message);
        res.status(500).render("productDetails", {
            user: req.session.user,
            error: "Failed to load product details",
        });
    }
};

module.exports = {
    loadShopPage,
    loadProductDetails,
    getDefaultPriceRange,
};