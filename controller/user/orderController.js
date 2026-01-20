const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema'); 
const PDFDocument = require('pdfkit');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const easyinvoice = require('easyinvoice');
const Address = require('../../models/addressSchema');

const getUserOrders = async (req, res) => {
    try {
        const userId = req.session.user._id;
        if (!userId) {
            return res.redirect('/signin');
        }

        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = 5; // Number of orders per page
        const skip = (page - 1) * limit;

        // Get total count of orders
        const totalOrders = await Order.countDocuments({ userId });
        const totalPages = Math.ceil(totalOrders / limit);

        // Fetch paginated orders with populated product details
        const orders = await Order.find({ userId })
            .populate({
                path: 'orderItems.product',
                select: 'productName productImage price' 
            })
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit);

        // Format orders for rendering
        const formattedOrders = orders.map(order => {
            return {
                _id: order._id,
                orderId: order.orderId,
                createdOn: order.createdOn,
                totalAmount: order.totalAmount,
                status: order.status,
                paymentStatus: order.paymentStatus,
                items: order.orderItems.map(item => ({
                    name: item.product?.productName || 'Product Unavailable',
                    image: item.product?.productImage?.[0] || '/images/default-product.jpg',
                    quantity: item.quantity,
                    price: item.price,
                    size: item.size,
                    status: item.status
                }))
            };
        });

        res.render('myorders', { 
            orders: formattedOrders,
            error: false,
            user: req.session.user,
            pagination: {
                page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error("Error fetching user orders:", error);
        res.render('myOrders', { 
            orders: [],
            error: true,
            user: req.session.user,
            pagination: {
                page: 1,
                totalPages: 1,
                hasNext: false,
                hasPrev: false
            }
        });
    }
};

const viewOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;


        const orders=await Order.findById(orderId)
        const user=req.session.user._id
        const userAddress= await Address.findOne({ userId: user })

        console.log('userAddress',userAddress)

        const address=userAddress.address.find((addr) => addr._id.toString() === orders.address.toString());

        console.log('address',address)



        
        const order = await Order.findById(orderId)
            .populate({
                path: 'orderItems.product',
                select: 'productName productImage price'
            })
            
            .lean()
            .exec();

        if (!order) {
            return res.status(404).render('orderFullDetails', {
                error: true,
                message: 'Order not found'
            });
        }

        res.render('orderFullDetails', {
            order,
            address,
            error: false,
            message: ''
        });

    } catch (err) {
        console.error('Error loading order details:', err);
        res.status(500).render('orderFullDetails', {
            error: true,
            message: 'Internal Server Error'
        });
    }
};

// Import the Wallet model

const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
const order = await Order.findById(orderId);
        const userId = req.session.user._id;
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if order belongs to user
        if (order.userId.toString() !== req.session.user._id.toString()) {
            return res.json({
                success: false,
                message: 'Unauthorized to cancel this order'
            });
        }

        // Check if order can be cancelled
        if (!['Pending', 'Processing'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: 'Order cannot be cancelled at this stage'
            });
        }

        for (const item of order.orderItems) {
            const product = await Product.findById(item.product._id);
            product.quantity += item.quantity;
            product.sizes[item.size] += item.quantity;
            console.log('product', product);
            await product.save();
            console.log('product updated', product);
            console.log('product size',product.sizes[item.size]);
        }

        // Update order status
        order.status = 'Cancelled';
        order.pa
        await order.save();



        // Check if payment method is online
        if (order.paymentMethod === 'Online Payment' && order.paymentStatus=== 'Paid' || order.paymentMethod === 'Wallet Payment') {
            const wallet = await Wallet.findOne({ user: userId });

            console.log('wallet balance',wallet.balance);
            console.log('order payable amount', order.payableAmount);

            console.log('wallet balance', wallet.balance);

            if (!wallet) {
                // Create a new wallet if it doesn't exist
                const newWallet = new Wallet({
                    user: userId,
                    balance: order.payableAmount,
                    history: [
                        {
                            amount: order.payableAmount,
                            status: 'credit',
                            description: `Refund for cancelled order ${orderId}`
                        }
                    ]
                });
                await newWallet.save();
            } else {
                // Update existing wallet
                wallet.balance += order.payableAmount;
                wallet.history.push({
                    amount: order.payableAmount,
                    status: 'credit',
                    description: `Refund for cancelled order ${orderId}`
                });
                await wallet.save();
            }

            console.log('Wallet updated:', wallet);
        }


        

        return res.json({
            success: true,
            message: 'Order cancelled successfully'
        });

    } catch (error) {
        console.error('Error cancelling order:', error);
        return res.json({
            success: false,
            message: 'Internal Server Error'
        });
    }
};



const submitReturnRequest = async (req, res) => {
    try {
        const { orderId, itemId, returnReason } = req.body;
        console.log(req.body)
        
        
        const order = await Order.findById(orderId);
        console.log('orderId',orderId)

        if (!order) {
            return res.status(404).json({ 
                success: false,
                message: "Order Not Found" 
            });
        }

        
        if (order.userId.toString() !== req.session.user._id.toString()) {
            return res.status(403).json({ 
                success: false,
                message: "Unauthorized" 
            });
        }

        
        const orderItem = order.orderItems.find(item => item._id.toString() === itemId);
        
        if (!orderItem) {
            return res.status(404).json({ 
                success: false,
                message: "Order item not found" 
            });
        }

       
        orderItem.returnRequest = true;
        orderItem.returnReason = returnReason;
        orderItem.returnStatus = 'Pending';
        orderItem.returnRequestDate = new Date();

        await order.save();

        res.json({ 
            success: true,
            message: "Return request submitted successfully"
        });

    } catch (error) {
        console.error('Return request error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Something went wrong', 
            error: error.message 
        });
    }
};


 // Adjust the path as necessary


// Controller function to generate and download the invoice


const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('orderItems.product')
            .populate('userId');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const userAddress = await Address.findOne({ userId: order.userId._id });
        const address = userAddress.address.find(addr => addr._id.toString() === order.address.toString());
        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found for this order'
            });
        }

        // Calculate product prices and GST details
        let gstAmount = order.gstAmount * 2;

        // Subtotal: sum of all base amounts (without GST)
        const subtotal = order.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Total GST: sum of GST for all items
        const totalGST = gstAmount * order.orderItems.length;

        // Products array for invoice
        const products = order.orderItems.map(item => {
            const baseAmount = item.price * item.quantity;
            const priceWithTax = baseAmount + gstAmount;
            return {
                description: `${item.product.productName} (Size: ${item.size})`,
                quantity: item.quantity,
                price: priceWithTax,
                customFields: [
                    { name: "GST Rate (%)", value: 'nil' },
                    { name: "GST Amount", value: gstAmount }
                ]
            };
        });

        // Grand total (subtotal + total GST)
        const grandTotal = subtotal + totalGST;

        const data = {
            currency: 'INR',
            taxNotation: 'gst',
            marginTop: 25,
            marginRight: 25,
            marginLeft: 25,
            marginBottom: 25,
            logo: 'https://public/images/your-logo.png',
            sender: {
                company: 'Verses Store',
                address: 'Karukappilly building 3rd floor, Near St. Antony\'s Church,Kakkanad',
                zip: '652512',
                city: 'Kochi',
                country: 'India'
            },
            client: {
                company: address.fullname,
                address: address.street,
                zip: address.zipCode,
                city: address.city,
                state: address.state,
                country: 'India'
            },
            information: {
                number: order._id,
                date: moment(order.createdOn).format('YYYY-MM-DD'),
                'due-date': moment(order.createdOn).format('YYYY-MM-DD')
            },
            products: products,
            // Show subtotal, GST, and grand total in bottom notice
            'bottom-notice': `Subtotal: ₹${subtotal.toFixed(2)}\nGST Amount: ₹${totalGST.toFixed(2)}\nGrand Total: ₹${grandTotal.toFixed(2)}\nThank you for your purchase!`,
            settings: {
                currency: 'INR',
                'tax-notation': 'gst',
                'margin-top': 50,
                'margin-right': 50,
                'margin-left': 50,
                'margin-bottom': 25
            }
        };

        // Create invoice
        const result = await easyinvoice.createInvoice(data);
        const pdfBuffer = Buffer.from(result.pdf, 'base64');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice_${orderId}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate invoice'
        });
    }
};




module.exports = {
    getUserOrders,
    viewOrderDetails,
    cancelOrder,
    submitReturnRequest,
    downloadInvoice
}