const express=require('express')
const session=require('express-session')
const path=require('path')
const passport=require('./config/passport')
const env=require('dotenv').config();
const userRouter=require('./routes/userRoute')
const adminRouter=require('./routes/adminRoute')
const connectdb=require('./config/connectDB')
const nocache=require('nocache');
const app=express()


app.use(express.urlencoded({extended:true}))
app.use(express.json())
app.use(session({
   secret:process.env.SESSION_SECRET,
   resave:false,
   saveUninitialized:true,
   cookie:{
       secure:false,
       httpOnly:true,
       maxAge:72*60*60*1000
   }
}))

app.use(passport.initialize())
app.use(passport.session())
app.use(express.static(path.join(__dirname,'public')))
app.use(nocache())

app.use('/',userRouter)
app.use('/admin',adminRouter)


app.set('view engine','ejs')
app.set('views',[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')])


connectdb()

app.listen(process.env.PORT,()=>{
   console.log(`server running on http://localhost:${process.env.PORT}`)
})



module.exports=app;