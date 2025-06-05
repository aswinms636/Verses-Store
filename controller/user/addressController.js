const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');




const getAddresses = async (req,res)=>{
    try {
        console.log(req.session.user);
        const userId = req.session.user._id;
      
        const addresses = await Address.find({ userId });
        console.log(addresses);
        

        res.render('myAddress',{
            addresses: addresses,
        })

    } catch (error) {
        
    }
};



const addAddress = async (req, res) =>{
    try {
        console.log( req.session.user);
        
        const userId = req.session.user._id;

        console.log(userId);

        if (!userId) {
            return res.json({ success: false, message: "User not authenticated" });
        }
        console.log(req.body);
        
        
        const {fullname,phone,street,city,landmark,state,zipCode} = req.body;

        console.log("req.body",req.body);

        const newAddressData={
                fullname:fullname,
                phone:phone,
                street:street,
                city:city,
                landmark:landmark,
                state:state,
                zipCode:zipCode,
                
            }
        

        const existingAddress=await Address.findOne({userId:userId})
        console.log('existing',existingAddress)

        if(existingAddress){
            existingAddress.address.push(newAddressData)
            console.log('updated address',existingAddress)
            existingAddress.save()
        }else{
            const  newAddress = new Address({
            userId:userId,
            address:[

                {fullname:fullname,
                phone:phone,
                street:street,
                city:city,
                landmark:landmark,
                state:state,
                zipCode:zipCode,
                
            }
            ]
        });
         await newAddress.save();
        console.log("22");
        console.log(newAddress);
        }
          
        res.json({success: true , message: "Address added successfully"});

    } catch (error) {
        console.error("error adding adress", error);
        res.json({success : false, message : "internal server error"});
        
    }
};

const editAddress = async (req, res) => {
    try {
        const { id, fullname, city, street, landmark, state, zipCode, phone } = req.body;
        const userId = req.session.user._id;

        // Find and update address in Address collection
        const addressDoc = await Address.findOne({ "address._id": id });
        
        if (!addressDoc) {
            return res.status(404).json({
                success: false,
                message: "Address not found."
            });
        }

        const addressToUpdate = addressDoc.address.id(id);
        
        if (!addressToUpdate) {
            return res.status(404).json({
                success: false,
                message: "Address not found."
            });
        }

        // Update address values
        addressToUpdate.fullname = fullname;
        addressToUpdate.city = city;
        addressToUpdate.street = street;
        addressToUpdate.landmark = landmark;
        addressToUpdate.state = state;
        addressToUpdate.zipCode = zipCode;
        addressToUpdate.phone = phone;

        await addressDoc.save();

        res.status(200).json({
            success: true,
            message: "Address updated successfully!"
        });

    } catch (error) {
        console.error("Error updating address:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update address."
        });
    }
};
  

  const deleteAddress = async (req, res) => {
    try {
        const { addressId } = req.body;
        const userId = req.session.user._id;

        console.log("Deleting address:", { userId, addressId });

        // Find the address document and pull the matching address from the array
        const result = await Address.updateOne(
            { userId: userId },
            { $pull: { address: { _id: addressId } } }
        );

        if (result.modifiedCount === 0) {
            return res.json({ 
                success: false, 
                message: 'Address not found or already deleted' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Address deleted successfully' 
        });

    } catch (error) {
        console.error('Error deleting address:', error);
        res.json({ 
            success: false, 
            message: 'Internal Server Error',
            error: error.message 
        });
    }
};
  
  



module.exports = {
    getAddresses,
    addAddress,
    editAddress,
    deleteAddress
}




