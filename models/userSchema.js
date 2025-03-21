const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: false,
        unique: false,
        sparse: true,
        default: null
    },
    password: {
        type: String,
        required: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    createdOn: {
        type: Date,
        default: Date.now
    },
    referalCode: {
        type: String
    },
    redeemed: {
        type: Boolean,
        default: false
    },
    redeemedUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: 'Category'
        },
        brand: {
            type: String
        },
        SearchOn: {
            type: Date,
            default: Date.now
        }
    }]
});

const User = mongoose.model('User', userSchema);


User.collection.dropIndex("googleId_1").catch(err => {
    if (err.codeName !== "NamespaceNotFound") {
        console.error("Error dropping index:", err);
    }
});


userSchema.index({ googleId: 1 }, { unique: true, sparse: true })

module.exports = User;
