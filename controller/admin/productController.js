const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { pageNotFound } = require('./adminController');
const { find } = require('../../models/userSchema');
const { Console } = require('console');

const uploadDir = path.join('public', 'Uploads', 'product-Images');


if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(` Upload directory created: ${uploadDir}`);
}


const validateImage = async (imagePath) => {
    try {
        const metadata = await sharp(imagePath).metadata();
        return metadata && metadata.format; 
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

      
        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            brand: products.brand,
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
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }
        
        console.error('Error adding product:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to add product'
        });
    }
};

const addProduct = async (req, res) => {
    try {
        const data = req.body;
        console.log("Received data:", data);
        console.log("Received files:", req.files);

        // Validate required fields
        if (!data.productName || !data.brand || !data.description || 
            !data.regularPrice || !data.salePrice || !data.quantity || 
            !data.category) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Check if product already exists
        const existingProduct = await Product.findOne({ productName: data.productName });
        if (existingProduct) {
            return res.status(400).json({
                success: false,
                message: 'Product with this name already exists'
            });
        }

        // Process images
        const images = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const filename = file.filename;
                images.push(filename);
            }
        }

        if (images.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one product image is required'
            });
        }

        // Process sizes
        const sizes = {
            6: parseInt(data.sizes[6]) || 0,
            7: parseInt(data.sizes[7]) || 0,
            8: parseInt(data.sizes[8]) || 0,
            9: parseInt(data.sizes[9]) || 0
        };

        
        

       
        const newProduct = new Product({
            productName: data.productName,
            brand: data.brand,
            description: data.description,
            regularPrice: parseFloat(data.regularPrice),
            salePrice: parseFloat(data.salePrice),
            quantity: parseInt(data.quantity),
            category: data.category,
            sizes: sizes,
            productImage: images
        });

        await newProduct.save();

      
        res.json({
            success: true,
            message: 'Product updated successfully'
        });

    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error adding product'
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


const editProduct = async (req, res, next) => {
    try {
        const id = req.params.id;
        const product = await Product.findOne({ _id: id });
        const data = req.body;

        console.log("file------------", req.files);
        const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id }
        });

        console.log("data", data);

        if (existingProduct) {
            return res.status(400).json({ error: "Product with this name already exists. Please try with another name" });
        }

        const images = [];

        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const originalImagePath = req.files[i].path;
                const resizedFilename = "resized-" + req.files[i].filename;
                const resizedImagePath = path.join('public', 'Uploads', 'product-Images', resizedFilename);
                await sharp(originalImagePath).resize({ width: 440, height: 440 }).toFile(resizedImagePath);
                images.push(resizedFilename);
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

        const category = await Category.findOne({ name: data.category });

        const updateFields = {
            productName: data.productName,
            description: data.descriptionData,
            brand: data.brand,
            category: category._id,
            regularPrice: data.regularPrice,
            salePrice: data.salePrice,
            quantity: parseInt(data.quantity),
            sizes: validSizes,
            productImage: images
        };

        

        console.log("updateFields", updateFields);
        await Product.findByIdAndUpdate(id, updateFields, { new: true });
        console.log("succ--------------------")
        res.json({
            success: true,
            message: 'Product updated successfully'
        });
    } catch (error) {
        console.error(error);
        next(error);
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
    addProduct,
    getAllProducts,
    addProductOffer,
    removeProductOffer,
    blockProduct,
    unblockProduct,
    loadEditProduct,
    editProduct,
   deleteSingleImg,

};






