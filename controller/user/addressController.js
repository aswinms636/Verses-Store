const Address = require('../../models/addressSchema'); // Adjust the path as necessary

// Controller to add a new address
async function addAddress(req, res) {
    try {
        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;
        const userId=req.session.user._id
        const newAddress = new Address({
            userId,
            address: [{
                addressType,
                name,
                city,
                landMark,
                state,
                pincode,
                phone,
                altPhone
            }]
        });

        await newAddress.save();
        console.log("addddddddddd",newAddress)
        res.status(201).json({ success:true , message: 'Address added successfully!' });
    } catch (error) {
        res.status(500).json({  success:false ,message: 'Error adding address', error });
    }
}

// Controller to update an existing address
async function updateAddress(req, res) {
    try {
        const { userId, addressId, addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

        const address = await Address.findOne({ userId });
        if (!address) {
            return res.status(404).json({ message: 'Address not found' });
        }

        const addr = address.address.id(addressId);
        if (!addr) {
            return res.status(404).json({ message: 'Address not found' });
        }

        addr.addressType = addressType;
        addr.name = name;
        addr.city = city;
        addr.landMark = landMark;
        addr.state = state;
        addr.pincode = pincode;
        addr.phone = phone;
        addr.altPhone = altPhone;

        await address.save();
        res.status(200).json({ message: 'Address updated successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating address', error });
    }
}

// Controller to load addresses for a user
async function loadAddresses(req, res) {
    try {
        const userId = req.session.user._id;
       
        const addresses = await Address.findOne({ userId }).populate('address')

        console.log(addresses)
     
        res.render('myAddress',{addresses})
    } catch (error) {
        res.status(500).json({ message: 'Error loading addresses', error });
    }
}

module.exports = { addAddress, updateAddress, loadAddresses };
