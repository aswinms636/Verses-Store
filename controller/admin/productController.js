const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { pageNotFound } = require('./adminController');
const { find } = require('../../models/userSchema');
const { Console } = require('console');

const uploadDir = path.join('public', 'Uploads', 'product-Images');

// Ensure the upload directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(` Upload directory created: ${uploadDir}`);
}

// Function to validate image files before processing
const validateImage = async (imagePath) => {
    try {
        const metadata = await sharp(imagePath).metadata();
        return metadata && metadata.format; // Ensure it's a valid image format
    } catch (err) {
        console.error(` Invalid or corrupt image file: ${imagePath}`, err);
        return false;
    }
};

const loadAddProduct = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true });
        res.render('addProducts', { cat: category });
    } catch (error) {
        console.error(' Error loading add product page:', error);
        res.redirect('/admin/pageNotFound');
    }
};

const addProducts = async (req, res) => {
    try {
        const products = req.body;
        const images = [];

        // Validate required fields
        if (!products.productName || !products.description || !products.brand || !products.category) {
            // Clean up any uploaded files
            if (req.files) {
                req.files.forEach(file => {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                });
            }
            return res.status(400).json({ error: "All fields are required" });
        }

        // Validate image upload
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "Product images are required" });
        }

        // Store image filenames
        for (const file of req.files) {
            images.push(file.filename);
        }

        // Check if product already exists
        const productExists = await Product.findOne({ 
            productName: { $regex: new RegExp(`^${products.productName}$`, 'i') }
        });

        if (productExists) {
            // Clean up uploaded files
            images.forEach(image => {
                const imagePath = path.join(uploadDir, image);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            });
            return res.status(400).json({ error: "Product already exists" });
        }

        // Get category
        const category = await Category.findOne({ name: products.category });
        if (!category) {
            // Clean up uploaded files
            images.forEach(image => {
                const imagePath = path.join(uploadDir, image);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            });
            return res.status(400).json({ error: "Invalid category" });
        }

        // Create new product
        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            brand: products.brand,
            category: category._id,
            regularPrice: parseFloat(products.regularPrice),
            salePrice: parseFloat(products.salePrice),
            quantity: parseInt(products.quantity),
            sizes: products.sizes || {},
            color: products.color,
            productImage: images,
            status: "Available"
        });

        await newProduct.save();

        res.status(200).json({
            status: true,
            message: 'Product added successfully'
        });

    } catch (error) {
        // Clean up any uploaded files on error
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }
        
        console.error('Error adding product:', error);
        res.status(500).json({
            status: false,
            message: error.message || 'Failed to add product'
        });
    }
};



const getAllProducts=async(req,res)=>{
    try {
        console.log('=========================1')
        const search=req.query.search || "";
        const page=req.query.page || 1;
        const limit=4;

        const productData=await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+ ".*",'i')}}
            ],
        }).limit(limit*1)
        .skip((page-1)*limit)
        .populate('category')
        .exec();    
        
        const count=await Product.find({
            $or:[
                {productName:{$regex:new RegExp('.*'+search+".*",'i')}}
            ],

        }).countDocuments();

        const category=await Category.find({isListed:true})
        console.log('=========================2')
        if(category){
            res.render('products',{
                data:productData,
                currentPage:page,
                totalPages:Math.ceil(count/limit),
                cat:category,

            })
        }else{
            res.redirect('/pageNotFound')
        }

    } catch (error) {
        console.log('catch',error)
        res.redirect('/pageNotFound')
        
    }
}



const addProductOffer= async(req,res)=>{
    try {
        
       const {productId,percentage}=req.body;
       const findProduct=await Product.findOne({_id:productId});
       const findCategory=await Category.findOne({_id:findProduct.category})


       if(findCategory.categoryOffer>percentage){
            return res.json({status:false,message:"This product category already has a category offer"})
        }

            findProduct.salePrice=findProduct.salePrice-Math.floor(findProduct.regularPrice*(percentage/100));
            findProduct.productOffer=parseInt(percentage);
            await findProduct.save();
            findCategory.categoryOffer=0;
            await findCategory.save();
            
            res.json({status:true,})

    } catch (error) {
        res.redirect('/pageNotFound')
        res.status(500).json({status:false,message:" Internal server error"})
    }
}


const removeProductOffer=async(req,res)=>{
    try {

        const {productId}=-req.body;

         const findProduct=await Product.findOne({id:productId})
         const percentage=findProduct.productOffer;
        
         findProduct.salePrice=findProduct.salePrice + Math.floor(findProduct.regularPrice*(percentage/100));
         
         findProduct.productOffer=0;
         await findProduct.save()
         res.json({status:true})
        
    } catch (error) {

        res.redirect('/pageNotFound')
        
        
    }
}



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


const loadEditProduct=async(req,res)=>{
    try {
        
        const id=req.query.id;
        const product=await Product.findOne({_id:id})
        const category=await Category.find({})

        res.render("editProduct",{
            product:product,
            cat:category,
            category:category

        })

    } catch (error) {
        res.redirect('/pageNotFound');
        
    }
}



const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;
        
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        // Validate sizes stock
        const sizes = data.sizes || {};
        let formattedSizes = {};
        let totalSizeStock = 0;

        for (let key in sizes) {
            if (sizes[key].trim() !== "") {
                const sizeQty = parseInt(sizes[key], 10);
                if (isNaN(sizeQty) || sizeQty < 0) {
                    return res.json({ error: 'Invalid size stock values' });
                }
                formattedSizes[key] = sizeQty;
                totalSizeStock += sizeQty;
            }
        }

        if (totalSizeStock > parseInt(data.quantity)) {
            return res.json({ error: 'Size stock cannot exceed total stock' });
        }

        // Process new images if any
        const newImages = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const filename = Date.now() + '-' + file.originalname;
                    const resizedImagePath = path.join('public', 'Uploads', 'product-Images', filename);
                    
                    const dir = path.dirname(resizedImagePath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }

                    await sharp(file.path)
                        .resize(440, 440)
                        .toFile(resizedImagePath);
                    
                    newImages.push(`/uploads/images/${filename}`);
                    fs.unlinkSync(file.path);
                } catch (err) {
                    console.error('Error processing new image:', err);
                }
            }
        }

        // Validate images (new + existing)
        const updatedImages = [...product.productImage, ...newImages];
        if (updatedImages.length === 0) {
            return res.json({ error: 'At least one image is required' });
        }

        // Validate category
        const categoryDoc = await Category.findOne({ name: data.category });
        if (!categoryDoc) {
            return res.json({ error: 'Invalid category' });
        }

        // Perform update
        await Product.findByIdAndUpdate(
            id,
            {
                productName: data.productName,
                description: data.description,
                brand: data.brand,
                category: categoryDoc._id,
                regularPrice: parseFloat(data.regularPrice),
                salePrice: parseFloat(data.salePrice),
                quantity: parseInt(data.quantity),
                color: data.color,
                sizes: formattedSizes,
                productImage: updatedImages
            },
            { new: true }
        );

        return res.json({ success: true, message: 'Product updated successfully' });

    } catch (error) {
        console.error("Error updating product:", error);
        return res.status(500).json({ 
            error: error.message || 'Failed to update product' 
        });
    }
};

    const deleteSingleImg = async (req, res) => {
        try {
            const { imageNameToServer, productIdToServer } = req.body;
            const product = await Product.findByIdAndUpdate(
                productIdToServer,
                { $pull: { productImage: imageNameToServer } }
            );


            console.log('=======1')
            
            const imagePath = path.join(__dirname, 'Uploads', imageNameToServer);

            console.log("=======3",imagePath)
    
            if (fs.existsSync(imagePath)) {
                await fs.unlinkSync(imagePath);
                console.log(`Image deleted successfully: ${imageNameToServer}`);
            } else {
                console.log(`Image not found: ${imageNameToServer}`);
            }

            console.log('=======2');
    
            res.send({ status: true ,message:"Image deleted successfully"});
    
        } catch (error) {
            console.error('Error deleting image:', error);
            res.redirect('/pageNotFound');
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






