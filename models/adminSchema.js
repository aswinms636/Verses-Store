
const mongoose=require('mongoose')

const {Schema}=mongoose

const Admin =new Schema({
    email:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:true
    }
})


const admin=mongoose.model('Admin',Admin)
module.exports=admin