const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { pageNotFound } = require('./adminController');
const { find } = require('../../models/userSchema');

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
        
        // Handle sizes properly
        const sizeMapping = { 6: 0, 7: 0, 8: 0, 9: 0 };
        
        // Convert size inputs to correct format
        if (products.sizes) {
            Object.entries(products.sizes).forEach(([size, quantity]) => {
                sizeMapping[size] = parseInt(quantity) || 0;
            });
        }

        // Check if product already exists
        const productExists = await Product.findOne({ productName: products.productName });

        if (productExists) {
            return res.status(400).json({ error: "Product already exists, please try another name" });
        }

        // Validate image upload
        if (!req.files || req.files.length === 0) {
            console.error("No image files uploaded.");
            return res.status(400).json({ error: "No image files uploaded." });
        }

        console.log('Uploaded files:', req.files.map(f => f.path));

        // Image processing
        const images = [];
        for (const file of req.files) {
            const originalImagePath = file.path;
            const resizedImagePath = path.join(uploadDir, file.filename);

            if (!fs.existsSync(originalImagePath)) {
                console.error(`File not found: ${originalImagePath}`);
                continue;
            }

            const isValid = await validateImage(originalImagePath);
            if (!isValid) {
                console.error(`Skipping invalid image: ${originalImagePath}`);
                continue;
            }

            try {
                await sharp(originalImagePath)
                    .resize({ width: 440, height: 440 })
                    .toFile(resizedImagePath);

                images.push(file.filename);
                console.log(`Image processed successfully: ${file.filename}`);
            } catch (err) {
                console.error(`Error processing image ${file.filename}:`, err);
            }
        }

        if (images.length === 0) {
            console.error("No valid images processed.");
            return res.status(400).json({ error: "No valid images processed." });
        }

        // Fetch category ID
        const categoryId = await Category.findOne({ name: products.category });

        if (!categoryId) {
            console.error("Invalid category name.");
            return res.status(400).json({ error: "Invalid category name" });
        }

        console.log('Category ID:', categoryId._id);

        // Save product
        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            brand: products.brand,
            category: categoryId._id,
            regularPrice: parseFloat(products.regularPrice),
            salePrice: parseFloat(products.salePrice),
            quantity: parseInt(products.quantity),
            sizes: sizeMapping,
            color: products.color,
            productImage: images, 
            status: "Available",
        });

        await newProduct.save();
        console.log("New product saved with sizes:", newProduct);

        res.status(200).json({ 
            status: true, 
            message: 'Product added successfully' 
        });

    } catch (error) {
        console.error('Error saving product:', error);
        res.status(500).json({ 
            status: false, 
            message: 'Failed to add product' 
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

        })

    } catch (error) {
        res.redirect('/pageNotFound');
        
    }
}




const editProduct=async(req,res)=>{
    try {
       console.log('====================1') 
        const id=req.params.id;
        console.log(id)
        const product=await Product.findOne({_id:id})
        const data=req.body;
        console.log(req.body);

        const existingProduct=await Product.findOne({
          productName:data.productName,
          _id:{$ne:id}  
        })

        if(existingProduct){
            return res.status(400).json({error:"Product with this name already exists. Please try with another name"})
        }

        const images=[];

        if(req.files && req.files.length>0){
            for(let i=0;i<req.files.length;i++){
                images.push(req.files[i].filename);
            }
        }


        const updateFields={

            productName:data.productName,
            description:data.description,
            brand:data.brand,
            category:product.category,
            regularPrice:data.regularPrice,
            salePrice:data.salePrice,
            quantity:data.quantity,
            size:data.size,
            color:data.color

        }

        if(req.files.length>0){
            updateFields.$push={productImage:{$each:images}}
        }
        await Product.findByIdAndUpdate(id,updateFields,{new:true});
        res.json({status:true,message:"Product updated successfully"})
        // res.redirect('/admin/products');

    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFound")
    }

}

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






