const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema');
const Address=require('../../models/addressSchema')

const getAllOrders = async (req, res) => {
    try {
        // Add pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = 5; // Orders per page
        const skip = (page - 1) * limit;

        // Get total count for pagination
        const totalOrders = await Order.countDocuments();
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find()
            .populate({
                path: 'orderItems.product',
                select: 'productName productImage'
            })
            .populate('userId', 'name email')
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit);

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
            title: 'All Orders',
            currentPage: page,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            nextPage: page + 1,
            previousPage: page - 1,
            lastPage: totalPages
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Server Error');
    }
};

const getOrderDetails = async(req,res)=>{
    try {
        const orderId = req.params.orderId;

        // Changed from findById to findOne with orderId
        const order = await Order.findOne({ orderId })
            .populate('userId','name email')
            .populate('orderItems.product','productName productImage');

        if(!order) {
            return res.status(404).send('Order Not Found');
        }

        const userAddress = await Address.findOne({ userId: order.userId });
        if (!userAddress) {
            return res.status(404).send('User Address Not Found');
        }     

        const address = userAddress.address.find(
            (addr) => addr._id.toString() === order.address.toString()
        );

        res.render('orderDetailsAdmin', {
            order,
            address,
        });

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

const acceptReturn = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const order = await Order.findOne({ _id: orderId });
        const item = order.orderItems.id(itemId);

        if (item) {
            item.returnStatus = 'Accepted';
            item.status = 'Returned';

            const allReturnedOrCancelled = order.orderItems.every(
                (i) => i.status === 'Returned' || i.status === 'Cancelled'
            );

            if (allReturnedOrCancelled) {
                order.status = 'Returned';
            }

            // Restore stock in the product model
            const product = await Product.findById(item.product);
            if (product) {
                product.sizes[item.size] += item.quantity;
                product.quantity += item.quantity;
                await product.save();
            } else {
                console.error("Product not found for ID:", item.product);
                return res.status(404).json({ message: "Product not found" });
            }

            // Find or create wallet
            let wallet = await Wallet.findOne({ user: order.userId });
            const refundAmount = item.price * item.quantity;

            if (!wallet) {
                wallet = new Wallet({
                    user: order.userId,
                    balance: refundAmount,
                    history: [{
                        amount: refundAmount,
                        status: 'credit',
                        description: `Refund for returned order ${order.orderId}`,
                        date: new Date()
                    }]
                });
            } else {
                wallet.balance += refundAmount;
                wallet.history.push({
                    amount: refundAmount,
                    status: 'credit',
                    description: `Refund for returned order ${order.orderId}`,
                    date: new Date()
                });
            }

            await wallet.save();
            await order.save();

            res.json({ 
                success: true, 
                message: "Return accepted and refund processed successfully" 
            });
        } else {
            res.status(404).json({ 
                success: false,
                message: "Order item not found" 
            });
        }
    } catch (error) {
        console.error("Error in returnaccept:", error);
        res.status(500).json({
            success: false, 
            message: "Internal server error" 
        });
    }
};

const rejectReturn = async(req,res)=>{
    try {
        
        const{orderId ,itemId } = req.params;
        const order = await Order.findById({_id:orderId});
        const item = order.orderItems.id(itemId);

        if(item){
            item.returnStatus="Rejected";
            await order.save();
            res.json({success:false,message: "Return rejected and order updated successfully "})
        }

    } catch (error) {
        res.json({success:false,message:"something went wrong !!!!!!!!!!!!!!!"})
        console.error('error in returnreject ',error);
    }
};

module.exports={
    getAllOrders,
    getOrderDetails,
    updateOrderStatus,
    getReturnOrders,
    acceptReturn,
    rejectReturn
}