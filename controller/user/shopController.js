const Category=require("../../models/categorySchema")
const Product=require("../../models/productSchema")

const loadShopPage = async (req, res) => {
    try {
        const user = req.session.user; 
        const categories = await Category.find({ isListed: true });

        let productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            quantity: { $gt: 0 }
        })
        .sort({ createdOn: -1 })
        .limit(4); 

        console.log('products.data', productData);

        if(user){
            res.render('shop', { user: user, products: productData });
        }else{
            res.render('shop', { products: productData });
        }

        
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};


module.exports={
    loadShopPage,
}    