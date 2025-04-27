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

const getOrderDetails = async(req,res)=>{
    try {
        
        const orderId = req.params.orderId;
        const order = await Order.findOne({ orderId })
        .populate('userId','name email')
        .populate('orderItems.product','productName productImage');

        if(!order){
            return res.status(404).send('Order Not Found ');
        }


        res.render('orderDetailsAdmin',
            {order}
        )

    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).send('Server Error');
    }
}



const updateOrderStatus = async(req,res)=>{
    try {
        
        const orderId = req.params.orderId;
        const { status } = req.body;

        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned'];

        if(!validStatuses.includes(status)){
            return res.status(400).json({ error: 'Invalid status' });
        }

        const order = await Order.findOneAndUpdate(
            {orderId},
            {status},
            {new : true}
        );

        if(!order){
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ success: true, message: 'Order status updated successfully', status: order.status });

    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
};

const getReturnOrders = async(req,res)=>{
    try {
        
        const returnOrders = await Order.find({
            "orderItems.returnRequest": true,
            "orderItems.returnStatus":"Pending"
        }).populate('orderItems.product').populate('userId');

        res.render("returnOrders",{
            returnOrders
        })

    } catch (error) {
        res.status(500).send('Server Error');
    }
};

module.exports={
    getAllOrders,
    getOrderDetails,
    updateOrderStatus,
    getReturnOrders
}