const User = require('../models/User')
const jwt = require('jsonwebtoken')
const { signupMail,passwordMail } = require('../config/nodemailer')
const path = require('path')
const { handleErrors,generateShortId } = require('../utilities/Utilities'); 
const crypto = require('crypto')
require('dotenv').config()
const { nanoId } = require("nanoid")
const mongoose=require('mongoose')
const Group = require('../models/Group')
const Post = require('../models/Post')
const cloudinary = require('cloudinary').v2
cloudinary.config({
    cloud_name:process.env.Cloud_Name,
    api_key:process.env.API_Key,
    api_secret:process.env.API_Secret
})
const maxAge = 30 * 24 * 60 * 60







// controller actions
module.exports.signup_get = (req, res) => {
    res.render('./userViews/signup',{
        type: 'signup'
    })
}

module.exports.login_get = (req, res) => {
    res.render('./userViews/signup',{
        type: 'login'
    })
}

module.exports.signup_post = async (req, res) => {
    const { name, email, password, confirmPwd, phoneNumber } = req.body
    const nominee=null
    // console.log("in sign up route",req.body);
    if (password != confirmPwd) {
        req.flash('error_msg', 'Passwords do not match. Try again')
        res.status(400).redirect('/user/login')
        return
    }

    try {
        const userExists = await User.findOne({ email })
        // console.log('userexists', userExists)
        /*if(userExists && userExists.active== false)
    {
      req.flash("success_msg",`${userExists.name}, we have sent you a link to verify your account kindly check your mail`)

      signupMail(userExists,req.hostname,req.protocol)
      return res.redirect("/signup")
    }*/
        if (userExists) {
            req.flash(
                'success_msg',
                'This email is already registered. Try logging in'
            )
            return res.redirect('/user/login')
        }
        const short_id =  generateShortId(name,phoneNumber);
        // console.log("Short ID generated is: ", short_id)
        const user = new User({ email, name, password, phoneNumber, short_id ,nominee})
        let saveUser = await user.save()
        // console.log(saveUser);
        req.flash(
            'success_msg',
            'Registration successful. Check your inbox to verify your email'
        )
        signupMail(saveUser, req.hostname, req.protocol)
        //res.send(saveUser)
        res.redirect('/user/login')
    } catch (err) {
        const errors = handleErrors(err)
        // console.log(errors)

        var message = 'Could not signup. '.concat((errors['email'] || ""), (errors['password'] || ""), (errors['phoneNumber'] || ""),(errors['name'] || "")  )
        //res.json(errors);
        req.flash(
            'error_msg',
            message
        )
        res.status(400).redirect('/user/signup')
    }
}
module.exports.emailVerify_get = async (req, res) => {
    try {
        const userID = req.params.id
        const expiredTokenUser = await User.findOne({ _id: userID })
        const token = req.query.tkn
        // console.log(token)
        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                req.flash(
                    'error_msg',
                    ' Your verify link had expired. We have sent you another verification link'
                )
                signupMail(expiredTokenUser, req.hostname, req.protocol)
                return res.redirect('/user/login')
            }
            const user = await User.findOne({ _id: decoded.id })
            if (!user) {
                // console.log('user not found')
                res.redirect('/')
            } else {
                const activeUser = await User.findByIdAndUpdate(user._id, {
                    active: true,
                })
                if (!activeUser) {
                    // console.log('Error occured while verifying')
                    req.flash('error_msg', 'Error occured while verifying')
                    res.redirect('/')
                } else {
                    req.flash(
                        'success_msg',
                        'User has been verified and can login now'
                    )
                    // console.log('The user has been verified.')
                    // console.log('active', activeUser)
                    res.redirect('/user/login')
                }
            }
        })
    } catch (e) {
        // console.log(e)
        //signupMail(user,req.hostname,req.protocol)
        res.redirect('/user/login')
    }
}

module.exports.login_post = async (req, res) => {
    const { email, password } = req.body
    // console.log('in Login route')
    //  console.log('req.body',req.body)
    try {

        const user = await User.login(email, password)
        // console.log("user",user)

        const userExists = await User.findOne({ email })  
    //    console.log("userexsits",userExists)
       

        if (!userExists.active) {
            const currDate = new Date();
            const initialUpdatedAt = userExists.updatedAt;
            const timeDiff = Math.abs(currDate.getTime() - initialUpdatedAt.getTime());
            if(timeDiff<=10800000)
            {
                // console.log("Email already sent check it")
                req.flash(
                    'error_msg',
                    `${userExists.name}, we have already sent you a verify link please check your email`)
                res.redirect('/user/login')
                return
            }
            req.flash(
                'success_msg',
                `${userExists.name}, your verify link has expired we have sent you another email please check you mailbox`
            )
            signupMail(userExists, req.hostname, req.protocol)
            await User.findByIdAndUpdate(userExists._id, { updatedAt: new Date() });
            // console.log('userExists',userExists)
            res.redirect('/user/login')
            return
        }
       
        const token = user.generateAuthToken(maxAge)

        res.cookie('jwt', token, { httpOnly: true, maxAge: maxAge * 1000 })
        // console.log(user);
        //signupMail(saveUser)
    //    console.log("logged in")
        req.flash('success_msg', 'Successfully logged in')
        res.status(200).redirect('/user/profile')
    } catch (err) {
        req.flash('error_msg', 'Invalid Credentials')
        // console.log(err)
        res.redirect('/user/login')
    }
}




module.exports.profile_get = async (req, res) => {
    res.send('Profile Page')
    // res.render('./userViews/profile', {
    //     path: '/user/profile',
    //     // profilePath
    //   })
    //   console.log("in profile page")
    }

module.exports.logout_get = async (req, res) => {
    // res.cookie('jwt', '', { maxAge: 1 });
    // const cookie = req.cookies.jwt
    res.clearCookie('jwt')
    req.flash('success_msg', 'Successfully logged out')
    res.redirect('/user/login')
} 

// module.exports.upload_get =async (req, res) => {
//   res.render("multer")
// }

module.exports.getForgotPasswordForm = async (req, res) => {
    res.render('./userViews/forgotPassword')
}

module.exports.getPasswordResetForm = async (req, res) => {
    const userID=req.params.id;
    const user = await User.findOne({ _id: userID })
    const resetToken = req.params.token
    res.render('./userViews/resetPassword', {
        userID,
        resetToken,
    })
}

module.exports.forgotPassword = async (req, res) => {
    const email=req.body.email
    const user = await User.findOne({ email })
    if (!user) {
        req.flash('error_msg', 'No user found')
        return res.redirect('/user/login')
    }
    // console.log(user)
    const userID = user._id
    
    const dt = new Date(user.passwordResetExpires).getTime()
    if (
        (user.passwordResetToken && dt > Date.now()) ||
        !user.passwordResetToken
    ) {
        const resetToken = user.createPasswordResetToken()
        // console.log(user.passwordResetExpires)
        // console.log(user.passwordResetToken)
        await user.save({ validateBeforeSave: false })
        try {
            passwordMail(user,resetToken,req.hostname, req.protocol)
            req.flash('success_msg', 'Email sent,please check email')
            res.redirect('/user/forgotPassword')
        } catch (err) {
            user.passwordResetToken = undefined
            user.passwordResetExpires = undefined
            await user.save({ validateBeforeSave: false })
            req.flash('error_msg', 'Unable to send mail')
            res.redirect('/user/forgotPassword')
        }
    } else {
        req.flash('error_msg', 'Mail already send,please wait for sometime to send again')
        res.redirect('/user/forgotPassword')
    }
}

module.exports.resetPassword = async (req, res) => {
    try {
        const token=req.params.token
        const id=req.params.id
        const hashedToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex')
        const user = await User.findOne({
            _id: req.params.id,
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
        })
        if (!user) {
            req.flash('error_msg', 'No user found')
            return res.redirect('/user/login')
        }
        if(req.body.password!==req.body.cpassword){
          req.flash('error_msg','Passwords dont match') 
          return res.redirect(`resetPassword/${id}/${token}`)
        }else{
            
        user.password = req.body.password
        user.passwordResetToken = undefined
        user.passwordResetExpires = undefined
        await user.save()
        const JWTtoken = await user.generateAuthToken(maxAge)
        // user = user.toJSON()
        res.cookie('jwt', JWTtoken, {
            maxAge: 24 * 60 * 60 * 1000,
            httpOnly: false,
        })
        res.redirect('/user/profile')
 
        }
   } catch (err) {
        res.send(err)
    }
}
module.exports.download=async(req,res)=>{
    const downloadpdf=req.query
    const params=new URLSearchParams(downloadpdf)
    const pathp=params.get('pdfdownload')
    var parts = pathp.split("/");
    var result = parts[parts.length - 1]//to get the file name
    const type=req.params.type//to get the type wheather 'medical/documnet'
    let reqPath = path.join(__dirname, `../../public/${pathp}/../${type}/${result}`)
    // console.log(reqPath) 
    res.download(reqPath, (error)=>{
        if(error){
            req.flash("error_msg", "error while downloading")
            // console.trace(error)
            return res.redirect('/user/profile')
        }
        res.end()
      })

}
module.exports.picupload_post=async(req,res)=>{
    const user=req.user
    const picPath=user.profilePic
    User.findOneAndUpdate({_id: user._id}, {$set:{profilePic:picPath}}, {new: true}, (err, doc) => {
        if (err) {
            // console.log("Something wrong when updating data!");
            req.flash("error_msg", "Something wrong when updating data!")
            res.redirect('/user/profile')
        }
        
        // console.log(doc);
    });
    res.redirect('/user/profile')
}
//start
module.exports.createGroup_post = async (req, res) => {
    const id=req.user._id
    const picture =req.file.path
    // console.log(picture)
    var pic=null
    await cloudinary.uploader.upload(picture,function(err,res){
        //  console.log(res)
        pic=res.secure_url
        // console.log(pic)
    })
    // console.log(id)
    const { name, desc,visibility,category } = req.body
    console.log(name,':',desc,":",visibility ,":",category)
    try {
        const groupExists = await Group.findOne({ name })
        
        if (groupExists) {
            req.flash(
                'success_msg',
                'This name already exist'
            )
            return res.redirect('/')//to be changed to groups landing page route
        }
        let arrayUsers=[id];
        const group = new Group({  name, desc,arrayUsers,visibility,pic,category})
        let groupUser = await group.save()


         console.log("check",groupUser);
        req.flash(
            'success_msg',
            'Group Added'
        )
        //res.send(saveUser)
        res.redirect('/')
    } catch (err) {
        // console.log(errors)
        req.flash(
            'error_msg',
            'Failed'
        )
        res.status(400).redirect('/')
    }
}
module.exports.onboarding_post = async (req, res) => {
    const user=req.user
    //how we pass matters
    const { color, favCeleb } = req.body
    // console.log(color,':',favCeleb)
    try {
        
        await User.findOneAndUpdate({_id: user._id}, {$set:{color}}, {new: true}, (err, doc) => {
            if (err) {
                // console.log("Something wrong when updating data!");
                req.flash("error_msg", "Something wrong when updating data!")
                res.redirect('/')
            }
            
            // console.log(doc);
        });
        await User.findOneAndUpdate({_id: user._id}, {$set:{favCeleb}}, {new: true}, (err, doc) => {
            if (err) {
                // console.log("Something wrong when updating data!");
                req.flash("error_msg", "Something wrong when updating data!")
                res.redirect('/')
            }
            
            // console.log(doc);
        });
        console.log(req.user)
        req.flash(
            'success_msg',
            'Details added'
        )
        //res.send(saveUser)
        res.redirect('/')
    } catch (err) {
        // console.log(errors)
        req.flash(
            'error_msg',
            'Failed'
        )
        res.status(400).redirect('/')
    }
}
module.exports.postinGroup_post=async (req, res) => {
    // const groupId=req.query
    // 61784d0307a9ec177861ea70
    // const params=new URLSearchParams(groupId)
    // const id=params.get('id')
    const id = req.params.id
    const { name, desc } = req.body
    const picture =req.file.path
    var pic=null
    await cloudinary.uploader.upload(picture,function(err,res){
        // console.log(res)
        pic=res.secure_url
        console.log(pic)
    })
    try {
        if(name.length==0||desc.length==0){
            req.flash(
                'error_msg',
                'Enter name and desc'
            )
            res.redirect('/')
        }
        else{
        const post = new Post({ name, desc,pic})
        console.log(post)
        let savePost = await post.save()
        const groupExists = await Group.findOne({ _id:id })
        // console.log(groupExists)
        const posts=groupExists.post
        posts.push(id)
        await Group.findOneAndUpdate({_id: id}, {$set:{post:posts}}, {new: true}, (err, doc) => {
            if (err) {
                req.flash("error_msg", "Something wrong when updating data!")
                res.redirect('/')
            }
            
        });
        req.flash(
            'success_msg',
            'Post Added'
        )
        //res.send(saveUser)
        res.redirect('/')
        }
    } catch (err) {
        // console.log(errors)
        req.flash(
            'error_msg',
            'Failed'
        )
        res.status(400).redirect('/')
    }
}
module.exports.updatePost_post = async (req, res) => {
    const id = req.params.id
    //how we pass matters
    const { name, desc } = req.body
    // console.log(color,':',favCeleb)
    try {
        
        if(name.length!==0){
            await Post.findOneAndUpdate({_id: id}, {$set:{name}}, {new: true}, (err, doc) => {
                if (err) {
                    // console.log("Something wrong when updating data!");
                    req.flash("error_msg", "Something wrong when updating data!")
                    res.redirect('/')
                }
                
                // console.log(doc);
            });
        }
        if(desc.length!==0){
            await Post.findOneAndUpdate({_id: id}, {$set:{desc}}, {new: true}, (err, doc) => {
                if (err) {
                    // console.log("Something wrong when updating data!");
                    req.flash("error_msg", "Something wrong when updating data!")
                    res.redirect('/')
                }
                
                // console.log(doc);
            });
        }
        req.flash(
            'success_msg',
            'Details added'
        )
        //res.send(saveUser)
        res.redirect('/')
    } catch (err) {
        // console.log(errors)
        req.flash(
            'error_msg',
            'Failed'
        )
        res.status(400).redirect('/')
    }
}
// createGroup_get
module.exports.createGroup_get = async (req, res) => {
    res.render('./userViews/create-group')
}