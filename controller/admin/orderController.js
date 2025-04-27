const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require('../../models/productSchema');

const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate({
                path: 'orderItems.product',
                select: 'productName productImage'
            })
            .populate('userId', 'name email')
            .sort({ createdOn: -1 });

        
        const formattedOrders = orders.map(order => {
            return {
                _id: order._id,
                orderId: order.orderId,
                status: order.status,
                createdOn: order.createdOn,
                totalAmount: order.totalAmount,
                orderItems: order.orderItems.map(item => ({
                    product: {
                        name: item.product ? item.product.productName : 'Product Unavailable',
                        image: item.product && item.product.productImage.length > 0 
                            ? item.product.productImage[0] 
                            : 'default.jpg'
                    },
                    quantity: item.quantity,
                    price: item.price
                }))
            };
        });

        res.render('orders', { 
            orders: formattedOrders,
            title: 'All Orders'
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Server Error');
    }
};

module.exports={
    getAllOrders
}