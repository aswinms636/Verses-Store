    const Address = require('../../models/addressSchema'); // Adjust the path as necessary


    // Controller to add a new address
    async function addAddress(req, res) {
        try {
            const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;
            const userId = req.session.user._id;

            console.log(landMark)

            // Validate input data
            if (!addressType || !name || !city || !landMark || !state || !pincode || !phone || !altPhone) {
                return res.status(400).json({ success: false, message: 'All fields are required' });
            }


            console.log(addressType, name, city, landMark, state, pincode, phone, altPhone );
            

            const newAddress = {
                addressType,
                name,
                city,
                landMark,
                state,
                pincode,
                phone,
                altPhone
            };

            let addressDoc = await Address.findOne({ userId });
            console.log(   "jhggg",addressDoc)

            if (addressDoc) {
                // If address document exists, push the new address to the array
                addressDoc.address.push(newAddress);
                console.log(addressDoc.address)
            } else {
                // If address document does not exist, create a new one
                addressDoc = new Address({
                    userId,
                    address: [newAddress]
                });
                console.log("...................",   addressDoc.address)
            }

            await addressDoc.save();
            res.json({ success: true, message: 'Address added successfully!' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: 'Error adding address' });
        }
    }

    // Controller to update an existing address
    async function updateAddress(req, res) {
        try {
            const { userId, addressId, addressType, name, city, landMark, state, pincode, phone, altPhone ,country } = req.body;

            // Validate input data
            if (!addressType || !name || !city || !landMark || !state || !pincode || !phone || !altPhone || country) {
                return res.status(400).json({ success: false, message: 'All fields are required' });
            }

            const addressDoc = await Address.findOne({ userId });
            if (!addressDoc) {
                return res.status(404).json({ success: false, message: 'Address not found' });
            }

            const addr = addressDoc.address.id(addressId);
            if (!addr) {
                return res.status(404).json({ success: false, message: 'Address not found' });
            }

            addr.addressType = addressType;
            addr.name = name;
            addr.city = city;
            addr.landMark = landMark;
            addr.country=country
            addr.state = state;
            addr.pincode = pincode;
            addr.phone = phone;
            addr.altPhone = altPhone;

            await addressDoc.save();
            res.json({ success: true, message: 'Address updated successfully!' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: 'Error updating address' });
        }
    }

    // Controller to load addresses for a user
    async function loadAddresses(req, res) {
        try {
            const userId = req.session.user._id;
            const addresses = await Address.findOne({ userId }).populate('address');
            res.render('myAddress', { addresses: addresses ? addresses.address : [] });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: 'Error loading addresses' });
        }
    }

    module.exports = { addAddress, updateAddress, loadAddresses };
