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
        console.log('Uploaded file:', req.file);
        const imageUrl = req.file ? req.file.path : null;
        console.log('Image URL:', imageUrl);

        const newBrand = new Brand({
            brandName: req.body.name,
            brandImage: imageUrl ? [imageUrl] : []
        });

        await newBrand.save();
        return res.status(200).json({ success: true, message: 'Brand added successfully' });

    } catch (error) {
        console.error('Error adding brand:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const blockBrand = async (req, res) => {
    try {
        const brandId = req.query.id;
        await Brand.findByIdAndUpdate(brandId, { isBlocked: true });
        return res.json({ success: true, message: 'Brand blocked successfully' });
    } catch (error) {
        console.error("Error blocking brand:", error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const unblockBrand = async (req, res) => {
    try {
        const brandId = req.query.id;
        await Brand.findByIdAndUpdate(brandId, { isBlocked: false });
        return res.json({ success: true, message: 'Brand unblocked successfully' });
    } catch (error) {
        console.error("Error unblocking brand:", error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const deleteBrand = async (req, res) => {
    try {
        const brandId = req.query.id;
        await Brand.findByIdAndDelete(brandId);
        return res.json({ success: true, message: 'Brand deleted successfully' });
    } catch (error) {
        console.error("Error deleting brand:", error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

module.exports={
    loadBrandPage,
    addBrand,
    blockBrand,
    unblockBrand,
    deleteBrand
}

