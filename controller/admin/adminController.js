const Admin = require("../../models/userSchema");
const bcrypt = require("bcrypt");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const ReportGenerator = require('../../helpers/pdf');

const loadlogin = async (req, res) => {
    try {
        res.render('admin-login')
    } catch (error) {
        res.status(500).send('server error')
    }
}

const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await Admin.findOne({ email });

        if (!admin) {
            return res.json({
                success: false,
                message: 'Invalid email address'
            });
        }

        // Check if user is admin
        if (!admin.isAdmin) {
            return res.json({
                success: false,
                message: 'Access denied. Not an admin account.'
            });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.json({
                success: false,
                message: 'Invalid password'
            });
        }

        req.session.admin = admin;
        return res.json({
            success: true,
            redirectUrl: '/admin/dashboard'
        });

    } catch (error) {
        console.error("Admin login error:", error);
        return res.json({
            success: false,
            message: 'Server error occurred'
        });
    }
};

const loadDashboard = async (req, res, next) => {
    if (req.session.admin) {
        try {
            let { startDate, endDate } = req.query;

            if (!startDate || !endDate || isNaN(new Date(startDate)) || isNaN(new Date(endDate))) {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 7); // Default to last 7 days
                startDate = start.toISOString().split('T')[0];
                endDate = end.toISOString().split('T')[0];
            }

            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setDate(end.getDate() + 1);

            // Get total sales (all time)
            const totalSalesAllTime = await Order.aggregate([
                { 
                    $match: { 
                        status: { $in: ["Delivered", "Shipped"] } 
                    } 
                },
                { 
                    $group: { 
                        _id: null, 
                        total: { $sum: "$totalAmount" },
                        count: { $sum: 1 }
                    } 
                }
            ]);

            // Get daily sales for the date range
            const dailySalesData = await Order.aggregate([
                {
                    $match: {
                        createdOn: { $gte: start, $lt: end },
                        status: { $in: ["Delivered", "Shipped", "Pending"] }
                    }
                },
                {
                    $group: {
                        _id: { 
                            $dateToString: { 
                                format: "%Y-%m-%d", 
                                date: "$createdOn" 
                            }
                        },
                        dailyTotal: { $sum: "$totalAmount" },
                        orderCount: { $sum: 1 },
                        items: { $sum: { $size: "$orderItems" } }
                    }
                },
                { $sort: { "_id": 1 } }
            ]);

            // Get sales summary for the selected period
            const periodSalesSummary = await Order.aggregate([
                {
                    $match: {
                        createdOn: { $gte: start, $lt: end },
                        status: { $in: ["Delivered", "Shipped", "Pending"] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalSales: { $sum: "$totalAmount" },
                        totalOrders: { $sum: 1 },
                        averageOrderValue: { $avg: "$totalAmount" },
                        totalItems: { $sum: { $size: "$orderItems" } }
                    }
                }
            ]);

            // Rest of your existing dashboard statistics
            const dashboardStats = await Promise.all([
                // Total Sales
                Order.aggregate([
                    { $match: { createdOn: { $gte: start, $lt: end } } },
                    { $group: { _id: null, total: { $sum: "$totalAmount" } } }
                ]),

                // Total Orders Count
                Order.countDocuments({ createdOn: { $gte: start, $lt: end } }),

                // Returns Count
                Order.countDocuments({ 
                    createdOn: { $gte: start, $lt: end },
                    status: "Returned"
                }),

                // Pending Orders
                Order.countDocuments({ 
                    createdOn: { $gte: start, $lt: end },
                    status: "Pending"
                }),

                // Delivered Orders
                Order.countDocuments({ 
                    createdOn: { $gte: start, $lt: end },
                    status: "Delivered"
                }),

                // Shipped Orders
                Order.countDocuments({ 
                    createdOn: { $gte: start, $lt: end },
                    status: "Shipped"
                }),

                // Total Users
                User.countDocuments({}),

                // Total Discounts Given
                Order.aggregate([
                    { $match: { createdOn: { $gte: start, $lt: end } } },
                    { $group: { _id: null, total: { $sum: "$couponDiscount" } } }
                ])
            ]);

            // Top Products
            const topProducts = await Order.aggregate([
                { $match: { createdOn: { $gte: start, $lt: end } } },
                { $unwind: "$orderItems" },
                { $lookup: { 
                    from: "products", 
                    localField: "orderItems.product", 
                    foreignField: "_id", 
                    as: "product" 
                }},
                { $unwind: "$product" },
                { $group: {
                    _id: "$orderItems.product",
                    productName: { $first: "$product.productName" },
                    totalQuantity: { $sum: "$orderItems.quantity" },
                    totalRevenue: { $sum: { $multiply: ["$orderItems.quantity", "$orderItems.price"] } }
                }},
                { $sort: { totalQuantity: -1 } },
                { $limit: 10 }
            ]);

            // Top Categories
            const topCategories = await Order.aggregate([
                { 
                    $match: { 
                        createdOn: { $gte: start, $lt: end },
                        status: { $in: ["Delivered", "Shipped"] }  // Only count completed orders
                    } 
                },
                { $unwind: "$orderItems" },
                {
                    $lookup: {
                        from: "products",
                        localField: "orderItems.product",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                { $unwind: "$product" },
                {
                    $lookup: {
                        from: "categories",
                        localField: "product.category",
                        foreignField: "_id",
                        as: "category"
                    }
                },
                { $unwind: "$category" },
                {
                    $group: {
                        _id: "$category._id",
                        categoryName: { $first: "$category.name" },
                        totalQuantity: { $sum: "$orderItems.quantity" },
                        totalRevenue: { 
                            $sum: { 
                                $multiply: ["$orderItems.quantity", "$orderItems.price"] 
                            } 
                        },
                        orderCount: { $sum: 1 }
                    }
                },
                { 
                    $sort: { 
                        totalRevenue: -1,  // Sort by revenue in descending order
                        totalQuantity: -1  // Then by quantity
                    } 
                },
                { $limit: 10 }
            ]);

            // Top Brands
            const topBrands = await Order.aggregate([
                { 
                    $match: { 
                        createdOn: { $gte: start, $lt: end },
                        status: { $in: ["Delivered", "Shipped"] }
                    } 
                },
                { $unwind: "$orderItems" },
                {
                    $lookup: {
                        from: "products",
                        localField: "orderItems.product",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                { $unwind: "$product" },
                {
                    $lookup: {
                        from: "brands",
                        localField: "product.brand",
                        foreignField: "_id",
                        as: "brandInfo"
                    }
                },
                { $unwind: "$brandInfo" },
                {
                    $group: {
                        _id: "$brandInfo._id",
                        brandName: { $first: "$brandInfo.brandName" },
                        brandImage: { $first: { $arrayElemAt: ["$brandInfo.brandImage", 0] } },
                        totalQuantity: { $sum: "$orderItems.quantity" },
                        totalRevenue: { 
                            $sum: { 
                                $multiply: ["$orderItems.quantity", "$orderItems.price"] 
                            } 
                        },
                        orderCount: { $sum: 1 }
                    }
                },
                {
                    $match: {
                        _id: { $ne: null }
                    }
                },
                { 
                    $sort: { 
                        totalRevenue: -1,
                        totalQuantity: -1
                    } 
                },
                { $limit: 10 }
            ]);

            // Daily Sales and Orders Chart Data
            const dailyData = await Order.aggregate([
                { $match: { createdOn: { $gte: start, $lt: end } } },
                { $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdOn" } },
                    sales: { $sum: "$totalAmount" },
                    orders: { $sum: 1 },
                    discounts: { $sum: "$couponDiscount" }
                }},
                { $sort: { "_id": 1 } }
            ]);

            // Top Canceled Orders
            const topCanceledOrders = await Order.aggregate([
                {
                    $match: {
                        status: 'Cancelled',
                        createdOn: { $gte: start, $lt: end }
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: '$user' },
                {
                    $project: {
                        orderId: 1,
                        createdOn: 1,
                        totalAmount: 1,
                        'user.name': 1,
                        paymentMethod: 1
                    }
                },
                { $sort: { createdOn: -1 } },
                { $limit: 10 }
            ]);

            res.render("dashboard", {
                stats: {
                    // Existing stats
                    totalSales: dashboardStats[0][0]?.total || 0,
                    totalOrders: dashboardStats[1] || 0,
                    returnsCount: dashboardStats[2] || 0,
                    pendingOrders: dashboardStats[3] || 0,
                    deliveredOrders: dashboardStats[4] || 0,
                    shippedOrders: dashboardStats[5] || 0,
                    totalUsers: dashboardStats[6] || 0,
                    totalDiscounts: dashboardStats[7][0]?.total || 0,
                    
                    // New sales statistics
                    allTimeSales: {
                        total: totalSalesAllTime[0]?.total || 0,
                        count: totalSalesAllTime[0]?.count || 0
                    },
                    periodSales: {
                        total: periodSalesSummary[0]?.totalSales || 0,
                        orders: periodSalesSummary[0]?.totalOrders || 0,
                        averageOrder: periodSalesSummary[0]?.averageOrderValue || 0,
                        items: periodSalesSummary[0]?.totalItems || 0
                    }
                },
                dailySales: dailySalesData,
                topProducts,
                topCategories: topCategories.map(category => ({
                    ...category,
                    totalRevenue: Math.round(category.totalRevenue), // Round to nearest rupee
                    totalQuantity: parseInt(category.totalQuantity)
                })),
                topBrands: topBrands.map(brand => ({
                    ...brand,
                    totalRevenue: Math.round(brand.totalRevenue),
                    totalQuantity: parseInt(brand.totalQuantity)
                })),
                chartData: dailyData,
                topCanceledOrders,
                startDate,
                endDate
            });

        } catch (error) {
            console.error("Dashboard error:", error);
            next(error);
        }
    } else {
        res.redirect("/admin/login");
    }
};

const logout = async (req, res) => {
    try {
        req.session.admin = null
        res.redirect('/admin/login')
    } catch (error) {
        res.status(500).send('logout error')
    }
}

const blockUser = async (req, res) => {
    try {
        const userId = req.query.id;
        if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
            return res.status(400).send('Invalid user ID');
        }

        const user = await User.findByIdAndUpdate(userId, { isBlocked: true }, { new: true });
        if (!user) {
            return res.status(404).send('User not found');
        }

        res.redirect('/admin/users?status=success&message=User blocked successfully');
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).send('Failed to block user');
    }
};

// Function to unblock a user
const unblockUser = async (req, res) => {
    try {
        const userId = req.query.id;
        if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
            return res.status(400).send('Invalid user ID');
        }

        const user = await User.findByIdAndUpdate(userId, { isBlocked: false }, { new: true });
        if (!user) {
            return res.status(404).send('User not found');
        }

        res.redirect('/admin/users?status=success&message=User unblocked successfully');
    } catch (error) {
        console.error('Error unblocking user:', error);
        res.status(500).send('Failed to unblock user');
    }
};

const toggleUserStatus = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Toggle blocked status
        user.isBlocked = !user.isBlocked;
        await user.save();

        res.json({
            success: true,
            isBlocked: user.isBlocked,
            message: `User has been ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`
        });

    } catch (error) {
        console.error('Toggle user status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getChartData = async (req, res) => {
    try {
        const { view } = req.query;
        const now = new Date();
        let startDate, groupBy;

        switch (view) {
            case 'weekly':
                startDate = new Date(now.setDate(now.getDate() - 7));
                groupBy = '%Y-%m-%d';
                break;
            case 'monthly':
                startDate = new Date(now.setMonth(now.getMonth() - 1));
                groupBy = '%Y-%m-%d';
                break;
            case 'yearly':
                startDate = new Date(now.setFullYear(now.getFullYear() - 1));
                groupBy = '%Y-%m';
                break;
            default:
                startDate = new Date(now.setDate(now.getDate() - 7));
                groupBy = '%Y-%m-%d';
        }

        const data = await Order.aggregate([
            {
                $match: {
                    createdOn: { $gte: startDate },
                    status: { $in: ["Delivered", "Shipped", "Pending"] }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: groupBy, date: "$createdOn" } },
                    sales: { $sum: "$totalAmount" },
                    orders: { $sum: 1 },
                    discounts: { $sum: "$couponDiscount" }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        res.json(data);
    } catch (error) {
        console.error('Error fetching chart data:', error);
        res.status(500).json({ error: 'Failed to fetch chart data' });
    }
};

const exportSalesReport = async (req, res) => {
    try {
        const { format, startDate, endDate } = req.query;
        
        // Fetch the report data (use your existing query logic)
        const reportData = await generateReportData(startDate, endDate);
        
        const period = {
            startDate: new Date(startDate).toLocaleDateString(),
            endDate: new Date(endDate).toLocaleDateString()
        };

        let buffer;
        let filename;
        let contentType;

        if (format === 'excel') {
            buffer = await ReportGenerator.generateExcel(reportData, period);
            filename = `sales-report-${startDate}-to-${endDate}.xlsx`;
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (format === 'pdf') {
            buffer = await ReportGenerator.generatePDF(reportData, period);
            filename = `sales-report-${startDate}-to-${endDate}.pdf`;
            contentType = 'application/pdf';
        } else {
            throw new Error('Invalid format specified');
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(buffer);

    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

// Add this helper function
async function generateReportData(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);

    // Your existing query logic to fetch sales data
    const dailySales = await Order.aggregate([
        {
            $match: {
                createdOn: { $gte: start, $lt: end },
                status: { $in: ["Delivered", "Shipped"] }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdOn" } },
                dailyTotal: { $sum: "$totalAmount" },
                orderCount: { $sum: 1 },
                items: { $sum: { $size: "$orderItems" } },
                discounts: { $sum: "$couponDiscount" }
            }
        },
        { $sort: { "_id": 1 } }
    ]);

    // Calculate period totals
    const periodSales = dailySales.reduce((acc, day) => ({
        total: acc.total + day.dailyTotal,
        orders: acc.orders + day.orderCount,
        items: acc.items + day.items,
       
    }), { total: 0, orders: 0, items: 0 });

    return { dailySales, periodSales };
}

module.exports = {
    adminLogin,
    loadlogin,
    loadDashboard,
    logout,
    blockUser,
    unblockUser,
    toggleUserStatus,
    getChartData,
    exportSalesReport
}