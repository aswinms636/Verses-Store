
const isLogin=async (req,res,next)=>{
    if(req.session.user){
        res.redirect('/')
    }else{
        next()           
    }
}


const checkSession=async (req,res,next)=>{
    if(req.session.user){
        next()
    }else{
        res.redirect('/signin')
    }
}


module.exports={
    isLogin,
    checkSession
}