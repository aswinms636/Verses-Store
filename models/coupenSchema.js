const mongoose = require("mongoose");

// Define the schema for coupons
const couponSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true, // Removes extra spaces
    unique: true, // Ensures coupon names are unique
  },
  offerPrice: {
    type: Number,
    required: true,
    min: 0, // Ensures the discount is not negative
  },
  expireOn: {
    type: Date,
    required: true, // Expiration date for the coupon
  },
  minimumPrice: {
    type: Number,
    required: true, 
    min: 0,
  },
  isList: {
    type: Boolean,
    default: true, 
  },
  userId: {
    type: [mongoose.Schema.Types.ObjectId], 
    ref: "User", 
    default: [],
  },
  createdOn: {
    type: Date,
    default: Date.now, 
  },
});


module.exports = mongoose.model("Coupon", couponSchema);