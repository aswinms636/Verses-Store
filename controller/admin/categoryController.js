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
        const { percentage, categoryId, adminPassword } = req.body;
        console.log(percentage, categoryId, adminPassword)
        // Validate inputs
        if (!percentage || !categoryId ) {
            return res.status(400).json({
                status: false,
                message: "Missing required fields"
            });
        }

        // Verify admin password
      

        // Validate percentage
        if (percentage < 0 || percentage > 90) {
            return res.status(400).json({
                status: false,
                message: "Offer percentage must be between 0 and 90"
            });
        }

        // Find category
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({
                status: false,
                message: "Category not found"
            });
        }

        // Check for existing product offers
        const products = await Product.find({ category: category._id });
        const hasHigherProductOffer = products.some(
            (product) => product.productOffer > percentage
        );

        if (hasHigherProductOffer) {
            return res.status(400).json({
                status: false,
                message: "Some products in this category have higher product offers"
            });
        }

        // Update category offer
        await Category.updateOne(
            { _id: categoryId },
            { $set: { categoryOffer: percentage } }
        );

        // Update product prices
        for (const product of products) {
            if (!product.productOffer) {
                product.salePrice = Math.floor(
                    product.regularPrice * (1 - percentage / 100)
                );
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




const removeCategoryOffer=async(req,res)=>{
    try {
        const categoryId=req.body.categoryId;
        const category=await Category.findById(categoryId) 
        if(!category){
            return res.status(404).json({status:false,message:"Category not found"})
        }

        const percentage=category.categoryOffer;
        const products=await Product.find({category:category._id})

        if(products.length>0){

            for(const product of products){
                product.salePrice+=Math.floor(product.regularPrice * (percentage/100))
                product.productOffer=0;
                await product.save();

            }

            category.categoryOffer=0;
            await category.save()
            res.json({status:true})

        }

    } catch (error) {
        res.status(500).json({status:false,message:"Internal Server Error"})
    }
}


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

        
        const existingCategory = await Category.findOne({
            name: categoryName,
            _id: { $ne: id }, 
        });

        if (existingCategory) {
            return res.status(400).json({ error: "Category name already exists, please choose another name" });
        }

        
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { name: categoryName, description: description },
            { new: true }
        );

        if (updatedCategory) {

            res.redirect('/admin/category');
            
        } else {
            res.status(404).json({ error: "Category not found" });
        }

    } catch (error) {
        console.error("Error updating category:", error);
        res.status(500).json({ error: "Internal server error" });
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