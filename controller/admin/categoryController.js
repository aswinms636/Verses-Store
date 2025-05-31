const Category=require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const mongoose=require('mongoose')
const bcrypt = require('bcrypt');
const Admin = require('../../models/adminSchema');

const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        // Build search query
        const searchQuery = search ? {
            name: { $regex: search, $options: 'i' }
        } : {};

        
        const categoryData = await Category.find(searchQuery)
            .sort({ createdAt: -1 }) 
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalCategories / limit);

        res.render('categoryPage', {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories,
            search: search
        });

    } catch (error) {
        console.error('Error in categoryInfo:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};


const addCategory=async(req,res)=>{
    const{name,description}=req.body

    try {
        const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });


        console.log("sadfsadf",existingCategory)
        if(existingCategory){
            return res.json({ success:false,  message:'Category already exists'})
        }

        const newCategory=new Category({
            name,
            description,
        })   
        
        await newCategory.save()

        console.log("----------------------------")
        return res.json({ success:true, message: 'Category added successfully' });
    } catch (error) {
        return res.status(500).json({error:'Internal server error'})
        
    }
}



const addCategoryOffer = async (req, res) => {
    try {
        const { percentage, categoryId } = req.body;
        console.log('Received offer data:', { percentage, categoryId });

        // Validate inputs
        if (!percentage || !categoryId) {
            return res.status(400).json({
                status: false,
                message: "Missing required fields"
            });
        }

        // Validate percentage
        const offerPercentage = parseInt(percentage);
        if (isNaN(offerPercentage) || offerPercentage < 0 || offerPercentage > 90) {
            return res.status(400).json({
                status: false,
                message: "Offer percentage must be between 0 and 90"
            });
        }

        // Find category and update
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({
                status: false,
                message: "Category not found"
            });
        }

        // Update category offer
        category.categoryOffer = offerPercentage;
        await category.save();

        // Update product prices in this category
        const products = await Product.find({ category: categoryId });
        for (const product of products) {
            if(product.productOffer > offerPercentage){
                return res.json({status: false, message: "Product offer is greater than category offer"});
            }

            if (!product.productOffer || product.productOffer < offerPercentage) {
                const discountAmount = Math.floor(product.regularPrice * (offerPercentage / 100));
                product.salePrice = product.regularPrice - discountAmount;
                console.log(  product.name,product.regularPrice, discountAmount, product.salePrice);
                console.log('Updated product sale price:', product.salePrice);
                await product.save();
            }
        }

        return res.json({
            status: true,
            message: "Category offer added successfully"
        });

    } catch (error) {
        console.error('Error in addCategoryOffer:', error);
        return res.status(500).json({
            status: false,
            message: "Internal server error"
        });
    }
};




const removeCategoryOffer = async (req, res) => {
    try {
        const { categoryId } = req.body;
        
        // Validate categoryId
        if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({
                status: false,
                message: "Invalid category ID"
            });
        }

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({
                status: false,
                message: "Category not found"
            });
        }

        // Store the current offer percentage before removing it
        const previousOffer = category.categoryOffer;
        
        // Reset category offer
        category.categoryOffer = 0;
        await category.save();

        // Update products in this category
        const products = await Product.find({ category: categoryId });
        for (const product of products) {
            // Only update price if category offer was being applied
            if (!product.productOffer || product.productOffer < previousOffer) {
                // Reset sale price to regular price or apply product offer if exists
                if (product.productOffer) {
                    // If product has its own offer, apply that
                    const productDiscountAmount = Math.floor(product.regularPrice * (product.productOffer / 100));
                    product.salePrice = product.regularPrice - productDiscountAmount;
                } else {
                    // If no product offer, reset to regular price
                    product.salePrice = product.regularPrice;
                }
                
                console.log(`Updating product ${product.productName}:`, {
                    regularPrice: product.regularPrice,
                    newSalePrice: product.salePrice,
                    productOffer: product.productOffer
                });
                
                await product.save();
            }
        }

        return res.json({
            status: true,
            message: "Category offer removed successfully"
        });

    } catch (error) {
        console.error('Error in removeCategoryOffer:', error);
        return res.status(500).json({
            status: false,
            message: "Internal server error"
        });
    }
};


const listCategory = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: false, message: "Invalid category ID" });
        }
        // Set isListed to true to list the category
        const result = await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        if (result.matchedCount === 0) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }
        res.json({ status: true, message: "Category listed successfully" });
    } catch (error) {
        console.error("Error in listCategory:", error);
        res.status(500).json({ status: false, message: error.message });
    }
};

const unlistCategory = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: false, message: "Invalid category ID" });
        }
        // Set isListed to false to unlist the category
        const result = await Category.updateOne({ _id: id }, { $set: { isListed: false } });
        if (result.matchedCount === 0) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }
        res.json({ status: true, message: "Category unlisted successfully" });
    } catch (error) {
        console.error("Error in unlistCategory:", error);
        res.status(500).json({ status: false, message: error.message });
    }
};


    const loadEditCategory = async (req, res) => {
        try {
            const id = req.params.id;
            console.log(id)

            const category = await Category.findById(id);
            console.log(category)

            if (!category) {
                console.log("Category not found for ID:", id);
                return res.render("admin/edit-Category", { category: null, error: "Category not found." });
            }
            console.log('rendered')
            res.render("edit-Category", {category }); 

        } catch (error) {
            console.error("Error loading category:", error);
            res.redirect("/pageNotfound");
        }
    };


const editCategory = async (req, res) => {
    try {
        const id = req.params.id;        
        const { categoryName, description } = req.body;

        
        const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${categoryName}$`, 'i') } });

        if (existingCategory) {
            return res.status(400).json({ success:false,message: "Category name already exists, please choose another name" });
        }

        
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { name: categoryName, description: description },
            { new: true }
        );

        if (updatedCategory) {

            res.json({ success:true, message: "Category updated successfully" });
            
        } else {
            res.json({ success:false, message: "Category not found" });
        }

    } catch (error) {
        console.error("Error updating category:", error);
        res.json({ success:false, message: "Internal server error" });
    }
};















module.exports={
    categoryInfo,
    addCategory,
    addCategoryOffer,
    removeCategoryOffer,
    listCategory,
    unlistCategory,
    loadEditCategory,
    editCategory,
}