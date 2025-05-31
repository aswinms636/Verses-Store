const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');



const fs = require('fs');
const path = require('path');
const sharp = require('sharp');


const mongoose = require('mongoose');
const { max } = require('moment');

const uploadDir = path.join('public', 'Uploads', 'product-Images');


if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(` Upload directory created: ${uploadDir}`);
}


// const validateImage = async (imagePath) => {
//     try {
//         const metadata = await sharp(imagePath).metadata();
//         return metadata && metadata.format; 
//     } catch (err) {
//         console.error(` Invalid or corrupt image file: ${imagePath}`, err);
//         return false;
//     }
// };

const loadAddProduct = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true });
        const brands = await Brand.find({ isBlocked: false }); // Fetch brands that are not blocked
        res.render('addProducts', { cat: category, brands: brands });
    } catch (error) {
        console.error('Error loading add product page:', error);
        res.redirect('/admin/pageNotFound');
    }
};

const addProducts = async (req, res) => {
    try {
        const products = req.body;
        const images = [];

        // Validate basic fields
        if (!products.productName || !products.description || !products.brand || !products.category) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const validSizes = { 6: 0, 7: 0, 8: 0, 9: 0 };
        let totalSizeQuantity = 0;

        if (products.sizes) {
            Object.keys(validSizes).forEach(size => {
                const quantity = parseInt(products.sizes[size]) || 0;
                validSizes[size] = quantity;
                totalSizeQuantity += quantity;
            });
        }

        const declaredQuantity = parseInt(products.quantity);
        if (totalSizeQuantity !== declaredQuantity) {
            return res.status(400).json({
                success: false,
                message: 'Total size quantities must match the total quantity'
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Product images are required"
            });
        }

        for (const file of req.files) {
            const originalImagePath = file.path;
            const resizedFilename = "resized-" + file.filename;
            const resizedImagePath = path.join('public', 'Uploads', 'product-Images', resizedFilename);

            await sharp(originalImagePath)
                .resize({ width: 440, height: 440 })
                .toFile(resizedImagePath);

            images.push(resizedFilename);
        }

        const productExists = await Product.findOne({
            productName: { $regex: new RegExp(`^${products.productName}$`, 'i') }
        });

        if (productExists) {
            images.forEach(image => {
                const imagePath = path.join(uploadDir, image);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            });
            return res.status(400).json({
                success: false,
                message: "Product already exists"
            });
        }

        const category = await Category.findOne({ name: products.category });
        if (!category) {
            return res.status(400).json({
                success: false,
                message: "Invalid category"
            });
        }
        

        const brand = await Brand.findById(products.brand);
        console.log('brand',brand)
        if (!brand) {
            return res.status(400).json({
                success: false,
                message: "Invalid brand"
            });
        }

        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            brand: brand._id, // Store the brand ObjectId
            category: category._id,
            regularPrice: parseFloat(products.regularPrice),
            salePrice: parseFloat(products.salePrice),
            quantity: declaredQuantity,
            sizes: validSizes,
            productImage: images,
            status: "Available"
        });

        await newProduct.save();

        res.status(200).json({
            success: true,
            message: 'Product added successfully'
        });

    } catch (error) {
        // Clean up any uploaded files on error
       

        console.error('Error adding product:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to add product'
        });
    }
};


const getAllProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; 
        const search = req.query.search || '';

        // Build search query
        const searchQuery = search ? {
            $or: [
                { productName: { $regex: search, $options: 'i' }},
                { brand: { $regex: search, $options: 'i' }}
            ]
        } : {};

       
        const productData = await Product.find(searchQuery)
            .sort({ createdAt: -1 }) 
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('category')
            .exec();

       
        const totalProducts = await Product.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalProducts / limit);

        res.render('products', {
            data: productData,
            currentPage: page,
            totalPages: totalPages,
            search: search
        });

    } catch (error) {
        console.error('Error in getAllProducts:', error);
        res.status(500).render('error', { message: 'Internal server error' });
    }
};

const addProductOffer = async(req, res) => {
    try {
        const { productId, percentage } = req.body;
        console.log("Received data:", req.body);
        
        // Validate percentage
        if (!percentage || percentage <= 0 || percentage > 90) {
            return res.json({
                status: false,
                message: "Please enter a valid offer percentage between 1 and 90"
            });
        }

        // Find product and populate brand and category
        const findProduct = await Product.findOne({ _id: productId })
            .populate('brand')
            .populate('category');
            
        if (!findProduct) {
            return res.json({
                status: false,
                message: "Product not found"
            });
        }

        // Check category offer
        if (findProduct.category.categoryOffer > percentage) {
            return res.json({
                status: false,
                message: "Category offer is higher than product offer"
            });
        }

        // Calculate new sale price with offer
        const discountAmount = Math.floor(findProduct.regularPrice * (percentage / 100));
        findProduct.salePrice = findProduct.regularPrice - discountAmount;
        findProduct.productOffer = parseInt(percentage);
        
        await findProduct.save();
        
        console.log("Product updated with offer:", {
            productId,
            originalPrice: findProduct.regularPrice,
            discountAmount,
            newSalePrice: findProduct.salePrice,
            offerPercentage: percentage
        });

        return res.json({
            status: true,
            message: "Offer added successfully"
        });

    } catch (error) {
        console.error("Error in addProductOffer:", error);
        res.status(500).json({
            status: false,
            message: "Internal server error"
        });
    }
};

const removeProductOffer = async (req, res) => {
    try {
        const { productId } = req.body;

        // Input validation
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.json({
                status: false,
                message: "Invalid product ID"
            });
        }

        const findProduct = await Product.findById(productId);
        if (!findProduct) {
            return res.json({
                status: false,
                message: "Product not found"
            });
        }

        // Store original values before update
        const originalOffer = findProduct.productOffer;
        const originalPrice = findProduct.regularPrice;

        if (originalOffer === 0) {
            return res.json({
                status: false,
                message: "No offer exists for this product"
            });
        }

        // Reset product offer and recalculate sale price
        findProduct.productOffer = 0;

        // Check if category has an offer
        const category = await Category.findById(findProduct.category);
        if (category && category.categoryOffer > 0) {
            // Apply category offer
            const categoryDiscountAmount = Math.floor(originalPrice * (category.categoryOffer / 100));
            findProduct.salePrice = originalPrice - categoryDiscountAmount;
        } else {
            // Reset to regular price if no category offer
            findProduct.salePrice = originalPrice;
        }

        await findProduct.save();

        console.log("Product offer removed:", {
            productId,
            originalOffer,
            originalPrice,
            newSalePrice: findProduct.salePrice
        });

        return res.json({
            status: true,
            message: "Offer removed successfully"
        });

    } catch (error) {
        console.error("Error in removeProductOffer:", error);
        return res.status(500).json({
            status: false,
            message: "Internal server error"
        });
    }
};

const blockProduct=async(req,res)=>{
    try {
        let id=req.query.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect('/admin/products')

    } catch (error) {
        res.redirect('/pageNotFound')
       
    }
}


const unblockProduct=async(req,res)=>{
    try {
        let id=req.query.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect('/admin/products')
    } catch (error) {
        res.redirect('/pageNotFound');
        
    }
}


const loadEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const product = await Product.findOne({ _id: id })
            .populate('brand')
            .populate('category');
            
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isBlocked: false });

        res.render("editProduct", {
            product: product,
            cat: categories,
            brands: brands
        });

    } catch (error) {
        console.error('Error loading edit product page:', error);
        res.redirect('/pageNotFound');
    }
}


const editProduct = async (req, res, next) => {
    try {
        const id = req.params.id;
        const product = await Product.findOne({ _id: id });
        if (!product) {
            return res.status(404).json({
                success: false,
                error: "Product not found"
            });
        }

        const data = req.body;

        // Validate brand and category IDs
        const brand = await Brand.findById(data.brand.trim());
        if (!brand) {
            return res.status(400).json({
                success: false,
                error: "Invalid brand selected"
            });
        }

        const category = await Category.findById(data.category);
        if (!category) {
            return res.status(400).json({
                success: false,
                error: "Invalid category selected"
            });
        }

        if(category){
            data.salePrice=data.regularPrice - Math.floor(data.regularPrice * (category.categoryOffer / 100));
        }
        console.log('update offer price',data.salePrice)

        // Initialize images with existing images
        let images = product.productImage || [];

        const maxFilesToSave = req.files.length - images.length
        
        console.log('file length',maxFilesToSave)
        // Set the maximum number of files you want to save
        let filesSaved = 0;

        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                if (filesSaved == maxFilesToSave) {
                    break; // Stop processing if the maximum number of files has been saved
                }

                const originalImagePath = req.files[i].path;
                const resizedFilename = "resized-" + req.files[i].filename;
                const resizedImagePath = path.join('public', 'Uploads', 'product-Images', resizedFilename);
                await sharp(originalImagePath).resize({ width: 440, height: 440 }).toFile(resizedImagePath);

                // Check for duplicate filenames
                if (!images.includes(resizedFilename)) {
                    images.push(resizedFilename);
                    filesSaved++; // Increment the count of files saved
                }
            }
        }

        // Initialize sizes with predefined keys
        const validSizes = { 6: 0, 7: 0, 8: 0, 9: 0 };

        if (Array.isArray(data.sizes)) {
            const sizeValues = data.sizes.slice(-4).map(size => parseInt(size));
            Object.keys(validSizes).forEach((key, index) => {
                validSizes[key] = sizeValues[index] || 0;
            });
        }

        console.log("-=---------=-------=", validSizes);
        console.log("img", images);

        const updateFields = {
            productName: data.productName,
            description: data.descriptionData,
            brand: brand._id,
            category: category._id,
            regularPrice: parseFloat(data.regularPrice),
            salePrice: parseFloat(data.salePrice),
            quantity: parseInt(data.quantity),
            sizes: validSizes,
            productImage: images
        };

        await Product.findByIdAndUpdate(id, updateFields, { new: true });

        res.json({
            success: true,
            message: 'Product updated successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error updating product'
        });
    }
};








    const deleteSingleImg = async (req, res) => {
        try {
            const { imageNameToServer, productIdToServer } = req.body;
            
            // Validate inputs
            if (!imageNameToServer || !productIdToServer) {
                return res.status(400).json({
                    status: false,
                    message: "Invalid request parameters"
                });
            }

            const product = await Product.findByIdAndUpdate(
                productIdToServer,
                { $pull: { productImage: imageNameToServer } }
            );

            if (!product) {
                return res.status(404).json({
                    status: false,
                    message: "Product not found"
                });
            }

            const imagePath = path.join(__dirname, 'Uploads', imageNameToServer);

            if (fs.existsSync(imagePath)) {
                await fs.unlinkSync(imagePath);
                console.log(`Image deleted successfully: ${imageNameToServer}`);
            } else {
                console.log(`Image not found: ${imageNameToServer}`);
            }

            return res.json({ 
                status: true,
                message: "Image deleted successfully"
            });

        } catch (error) {
            console.error('Error deleting image:', error);
            return res.status(500).json({
                status: false,
                message: "Error deleting image"
            });
        }
    };
    



module.exports = {
    loadAddProduct,
    addProducts,
    getAllProducts,
    addProductOffer,
    removeProductOffer,
    blockProduct,
    unblockProduct,
    loadEditProduct,
    editProduct,
   deleteSingleImg,

};






