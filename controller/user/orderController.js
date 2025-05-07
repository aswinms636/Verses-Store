const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema'); 
const PDFDocument = require('pdfkit');
const puppeteer = require('puppeteer');

const getUserOrders = async (req, res) => {
    try {
        const userId = req.session.user._id;
        if (!userId) {
            return res.redirect('/signin');
        }

        

        // Fetch orders with populated product details
        const orders = await Order.find({ userId })
            .populate({
                path: 'orderItems.product',
                select: 'productName productImage price' 
            })
            .sort({ createdOn: -1 });

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
            user: req.session.user
        });

    } catch (error) {
        console.error("Error fetching user orders:", error);
        res.render('myOrders', { 
            orders: [],
            error: true,
            user: req.session.user
        });
    }
};

const viewOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId).populate('orderItems.product') .exec();

        console.log('orderID',orderId)

        if (!order) {
            return res.status(404).send('Order not found');
        }

        
        if (order.userId.toString() !== req.session.user._id.toString()) {
            return res.status(403).send('Unauthorized');
        }

        res.render('orderFullDetails', { order });
    } catch (err) {
        console.error('Error loading order details:', err);
        res.status(500).send('Internal Server Error');
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
        await order.save();



        // Check if payment method is online
        if (order.paymentMethod === 'Online Payment'|| order.paymentMethod === 'Wallet Payment') {
            const wallet = await Wallet.findOne({ user: userId });

            console.log('wallet', wallet);

            if (!wallet) {
                // Create a new wallet if it doesn't exist
                const newWallet = new Wallet({
                    user: userId,
                    balance: order.totalPrice,
                    history: [
                        {
                            amount: order.totalPrice,
                            status: 'credit',
                            description: `Refund for cancelled order ${orderId}`
                        }
                    ]
                });
                await newWallet.save();
            } else {
                // Update existing wallet
                wallet.balance += order.totalPrice;
                wallet.history.push({
                    amount: order.totalPrice,
                    status: 'credit',
                    description: `Refund for cancelled order ${orderId}`
                });
                await wallet.save();
            }
        }


        

        return res.json({
            success: true,
            message: 'Order cancelled successfully'
        });

    } catch (error) {
        console.error('Error cancelling order:', error);
        return res.status(500).json({
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


async function downloadInvoice(req, res) {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId).populate('orderItems.product');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const content = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
                    .invoice { width: 80%; margin: auto; overflow: hidden; }
                    .header, .footer { background-color: #f4f4f4; text-align: center; padding: 10px; }
                    .main { padding: 20px; }
                    .info { margin-bottom: 20px; }
                    .info div { margin-bottom: 10px; }
                    .items { border-collapse: collapse; width: 100%; }
                    .items th, .items td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    .items th { background-color: #f4f4f4; }
                </style>
            </head>
            <body>
                <div class="invoice">
                    <div class="header">
                        <h1>Invoice</h1>
                    </div>
                    <div class="main">
                        <div class="info">
                            <div>Invoice Date: ${new Date().toDateString()}</div>
                            <div>Order ID: ${order.orderId}</div>
                            <div>Total Amount: ₹${order.totalAmount}</div>
                            <div>Payment Method: ${order.paymentMethod}</div>
                            <div>Status: ${order.status}</div>
                        </div>
                        <table class="items">
                            <tr>
                                <th>Product</th>
                                <th>Size</th>
                                <th>Quantity</th>
                                <th>Price</th>
                            </tr>
                            ${order.orderItems.map(item => `
                                <tr>
                                    <td>${item.product.name}</td>
                                    <td>${item.size}</td>
                                    <td>${item.quantity}</td>
                                    <td>₹${item.price}</td>
                                </tr>
                            `).join('')}
                        </table>
                    </div>
                    <div class="footer">
                        <p>Thank you for your purchase!</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(content);
        const pdf = await page.pdf({ format: 'A4' });

        await browser.close();

        res.setHeader('Content-disposition', `attachment; filename="invoice_${order.orderId}.pdf"`);
        res.setHeader('Content-type', 'application/pdf');
        res.send(pdf);
    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).json({ message: 'Failed to generate invoice' });
    }
}





module.exports = {
    getUserOrders,
    viewOrderDetails,
    cancelOrder,
    submitReturnRequest,
    downloadInvoice
}