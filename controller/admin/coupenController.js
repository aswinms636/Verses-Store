
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

const createCoupon = async (req, res, next) => {
    try {
        const data = {
            couponName: req.body.couponName,
            startDate: new Date(req.body.startDate + "T00:00:00"),
            endDate: new Date(req.body.endDate + "T00:00:00"),
            offerPrice: parseInt(req.body.offerPrice),
            minimumPrice: parseInt(req.body.minimumPrice),
        };

        const newCoupon = new Coupon({
            name: data.couponName,
            createdOn: data.startDate,
            expireOn: data.endDate,
            offerPrice: data.offerPrice,
            minimumPrice: data.minimumPrice,
            isList: true 
        });
        await newCoupon.save();
        return res.redirect("/admin/coupon");
    } catch (error) {
        next(error);
    }
};

module.exports = {
    loadCoupon,
    createCoupon,
};