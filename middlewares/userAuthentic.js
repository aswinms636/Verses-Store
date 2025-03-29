
const User=require('../models/userSchema')

const isLogin=async (req,res,next)=>{
    if(req.session.user){
        res.redirect('/')
    }else{
        next()           
    }
}


const blockCheck = async (req, res, next) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return next();
        }
  
        const userData = await User.findById(userId);
        
        if (userData?.isBlocked) {
            delete req.session.user
            req.redirect('/')
        }
  
        next();
  
    } catch (error) {
        console.log("Error in block check middleware:", error);
        next();
    }
  };

const checkSession=async (req,res,next)=>{
    if(req.session.user){
        next()
    }else{
        res.redirect('/signin')
    }
}


module.exports={
    isLogin,
    checkSession,
    blockCheck
}