const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema');




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

        console.log(userId)

        if (!userId) {
            return res.json({ success: false, message: "User not authenticated" });
        }
        console.log(req.body);
        
        
        const {fullname,phone,street,city,landmark,state,zipCode} = req.body;

        console.log(req.body);
        

          console.log("2");
          
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
        

        
        res.json({success: true , message: "Address added successfully"});

    } catch (error) {
        console.error("error adding adress", error);
        res.json({success : false, message : "internal server error"});
        
    }
};

const editAddress = async (req, res) => {
    try {
      const { id, fullname, city, street, landmark, state, zipCode, phone } = req.body;

      console.log('req.body-====================',req.body)
  
      
      const addressDoc = await Address.findOne({ "address._id": id });

      console.log(addressDoc)
  
      if (!addressDoc) {
        return res.status(404).json({ success: false, message: "Address not found." });
      }
  
     
      const addressToUpdate = addressDoc.address.id(id);

      console.log('-------',addressToUpdate)
  
      if (!addressToUpdate) {
        return res.status(404).json({ success: false, message: "Address not found." });
      }
  
      
      addressToUpdate.fullname = fullname;
      addressToUpdate.city = city;
      addressToUpdate.street = street;
      addressToUpdate.landmark = landmark;
      addressToUpdate.state = state;
      addressToUpdate.zipCode = zipCode;
      addressToUpdate.phone = phone;
  
      
      await addressDoc.save();


      console.log("-------------------------------");
      
  
      res.status(200).json({ success: true, message: "Address updated successfully!" });
    } catch (error) {
      console.error("Error updating address:", error);
      res.status(500).json({ success: false, message: "Failed to update address." });
    }
  };
  

  const deleteAddress = async (req, res) => {
    try {
      const {  addressId } = req.body;
      const userId=req.session.user._id
     
      console.log("=------=", userId, addressId);

      const user = await Address.findOne({ userId });
      if (!user) {
        return res.json({ success: false, message: 'User not found' });
      }
  
      
      const addressIndex = user.address.findIndex(addr => addr._id.toString() === addressId);
      if (addressIndex === -1) {
        return res.json({ success: false, message: 'Address not found' });
      }
  
      user.address.splice(addressIndex, 1);
  
     
      await user.save();
      res.json({ success: true, message: 'Address deleted successfully' });
    } catch (error) {
      console.error('Error deleting address:', error);
      res.json({ success: false, message: 'Internal Server Error' });
    }
  };
  
  



module.exports = {
    getAddresses,
    addAddress,
    editAddress,
    deleteAddress
}