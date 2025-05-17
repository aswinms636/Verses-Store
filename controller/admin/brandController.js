const Brand=require("../../models/brandSchema");
const Category=require("../../models/categorySchema");
const Product=require("../../models/productSchema");

const loadBrandPage=async(req,res)=>{   
    try {
        const brands = await Brand.find().lean();
        console.log( 'brand', brands);
        const categories = await Category.find();
        res.render('brand',{
            brands
        })
    } catch (error) {
        console.error("Error loading brand page:", error);
        res.status(500).send("Internal Server Error");
    }
}


const addBrand = async (req, res) => {
    try {
        // Log the file information
        console.log('Uploaded file:', req.file);
        
        // Make sure you're saving the complete URL
        const imageUrl = req.file ? req.file.path : null;
        console.log('Image URL:', imageUrl);

        const newBrand = new Brand({
            brandName: req.body.name,
            brandImage: imageUrl ? [imageUrl] : [] // Save as array
        });

        await newBrand.save();
        res.status(200).json({ message: 'Brand added successfully' });

    } catch (error) {
        console.error('Error adding brand:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Add these new controller methods

const blockBrand = async (req, res) => {
    try {
        const brandId = req.query.id;
        await Brand.findByIdAndUpdate(brandId, { isBlocked: true });
        res.redirect('/admin/brands');
    } catch (error) {
        console.error("Error blocking brand:", error);
        res.status(500).send("Internal Server Error");
    }
};

const unblockBrand = async (req, res) => {
    try {
        const brandId = req.query.id;
        await Brand.findByIdAndUpdate(brandId, { isBlocked: false });
        res.redirect('/admin/brands');
    } catch (error) {
        console.error("Error unblocking brand:", error);
        res.status(500).send("Internal Server Error");
    }
};

const deleteBrand = async (req, res) => {
    try {
        const brandId = req.query.id;
        await Brand.findByIdAndDelete(brandId);
        res.redirect('/admin/brands');
    } catch (error) {
        console.error("Error deleting brand:", error);
        res.status(500).send("Internal Server Error");
    }
};

module.exports={
    loadBrandPage,
    addBrand,
    blockBrand,
    unblockBrand,
    deleteBrand
}

