const Coupon = require("../../models/coupenSchema");
const mongoose = require("mongoose");

const loadCoupon = async (req, res, next) => {
    try {
        const findCoupons = await Coupon.find({});
        return res.render("coupon", { coupons: findCoupons });
    } catch (error) {
        next(error);
    }
};

const createCoupon = async (req, res) => {
    try {
        const data = {
            couponName: req.body.couponName,
            startDate: new Date(req.body.startDate),
            endDate: new Date(req.body.endDate),
            offerPrice: parseInt(req.body.offerPrice),
            minimumPrice: parseInt(req.body.minimumPrice),
        };

        console.log("Coupon Data:", data);

        // Additional server-side validation
        if (data.startDate <= new Date() || 
            data.endDate <= data.startDate || 
            data.offerPrice >= data.minimumPrice) {
            return res.json({
                success: false,
                message: "Invalid coupon data"
            });
        }

        console.log("Coupon Data after validation:", data);

        const newCoupon = new Coupon({
            name: data.couponName,
            createdOn: data.startDate,
            expireOn: data.endDate,
            offerPrice: data.offerPrice,
            minimumPrice: data.minimumPrice,
            isList: true
        });

        await newCoupon.save();

        console.log("New Coupon Created:", newCoupon);

        res.json({
            success: true,
            message: "Coupon created successfully",
            coupon: newCoupon
        });
    } catch (error) {
        console.error("Error creating coupon:", error);
        res.json({
            success: false,
            message:  "Failed to create coupon",
        });
    }
};

module.exports = {
    loadCoupon,
    createCoupon,
};