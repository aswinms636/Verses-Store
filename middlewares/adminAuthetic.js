const isLogin=async (req,res,next)=>{
    if(req.session.admin){
        res.redirect('/admin/dashboard')
    }else{
        next()
    }
}




module.exports={
    isLogin,
}