const express = require("express")
const bcrypt = require("bcryptjs")
const crypto = require('crypto');
const router = new express.Router()

const sendMail = require("../sendMail")

const Users = require("../models/users")
const {jwtAuthMiddleware, generateToken} = require('../jwt');

// User Signup
router.post('/signup', async(req, res) => {
    try{

        const { name, email, age, mobile, address, aadharcardNumber, password, role } = req.body;

        // Validate required fields
        if (!name || !age || !address || !aadharcardNumber || !password) {
            return res.status(400).json({message: "All fields are required"});
        }

        // Ensure only one admin can exist
        if (role === 'admin') {
            const adminExists = await Users.findOne({ role: 'admin' });
            if (adminExists) {
                return res.status(400).send({message: "An admin user already exists. Cannot add another admin."});
            }
        }

        // Generate email verification token
        const emailVerificationToken = crypto.randomBytes(32).toString('hex');

        // Create a new user
        const newUser = new Users({ name, email, age, mobile, address, aadharcardNumber, password, role });
        newUser.tokens = newUser.tokens.concat({ token: emailVerificationToken, type: 'emailVerification' })
        const savedUser = await newUser.save();

        // Generate token and save it to the user
        const token = generateToken(savedUser._id)
        savedUser.tokens = savedUser.tokens.concat({ token, type: 'auth' });
        await savedUser.save();

        let url = `${process.env.BASE_URL}/user/verify-email/${emailVerificationToken}`

        await sendMail(savedUser.email, "Verify Email", `<a href="http://${url}">${url}</a>`)

        res.status(201).json({token, savedUser});

    }catch(e){
        res.status(500).json({error: e.message})
    }
})

// Verify Email
router.get("/verify-email/:token", async(req,res) => {
    try{
        const token = req.params.token

        // Find user by email verification token
        const user = await Users.findOne({"tokens.token": token, "tokens.type": "emailVerification"})
        if(!user){
            return res.status(404).json({ message: 'Token not valid or expired' });
        }

        user.isEmailVerified = true
        user.tokens = user.tokens.filter(t => t.token !== token);
        await user.save()

        res.status(200).json({ message: 'Email verified successfully' });

    }catch(e){
        res.status(500).json({error: e.message})
    }
})

// User Login
router.post("/login", async(req, res) => {
    try{
        const {aadharcardNumber, password} = req.body

        // Find user by Aadhar card number
        const user = await Users.findOne({aadharcardNumber})
        if(!user){
            return res.status(401).send("Invalid login details");
        }

        // Check if password matches
        const isMatch = await bcrypt.compare(password, user.password)
        if(!isMatch){
            return res.status(401).json({ message: "Invalid login details" });
        }

        // Check 2fa status
        if(user.is2faEnabled){
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const otpExpires = Date.now() + 10 * 60 * 1000; 

            user.otp = otp;
            user.otpExpires = otpExpires;
            await user.save();

            await sendMail(user.email, "Two Factor Authentication OTP", otp)

            return res.status(200).json({message: "Two Factor Authentication OTP Sent Successfully."})
        }

        // Generate token and set cookie
        const token = generateToken(user.id)
        res.cookie("jwt", token, {
            expires: new Date(Date.now() + 30000) // Token expiry time
        })

        res.status(200).json({ token });

    }catch(e){
        res.status(500).json({error: e.message})
    }
})

// Verify Two Factor OTP
router.post("/verify-2fa-otp", async(req, res) => {
    try{

        const {email, otp} = req.body
        const user = await Users.findOne({email, otp, otpExpires: {$gt: Date.now()}})

        if(!user){
            return res.status(400).json({message: "Invalid OTP"})
        }

        user.otp = undefined
        user.otpExpires = undefined
        await user.save()

        // Generate token and set cookie
        const token = generateToken(user.id)
        res.cookie("jwt", token, {
            expires: new Date(Date.now() + 30000) // Token expiry time
        })

        res.status(200).json({message: "OTP Verify Successfully.", token });

    }catch(e){
        res.status(500).json({error: e.message})
    }
})

// Forgot Password
router.post("/forgot-password", async(req, res) => {
    try{
        const { email } = req.body

        // Find user by email
        const user = await Users.findOne({email})
        if(!user){
            return res.status(401).json({message: "User with given email does not exits"})
        }

        // Generate forgot password token
        const forgotPasswordToken = crypto.randomBytes(32).toString('hex');
        user.tokens = user.tokens.concat({ token: forgotPasswordToken, type: 'forgotPassword' });
        await user.save()

        let url = `${process.env.BASE_URL}/user/reset-password/${forgotPasswordToken}`

        await sendMail(user.email, "Reset Password", `<a href="http://${url}">${url}</a>`)

        res.status(201).json({message: "Password reset email sent"});
    }catch(e){
        res.status(500).send({error: e.message})
    }
})

// Reset Password
router.post("/reset-password/:token", async(req, res) => {
    try{

        const { password } = req.body
        const { token } = req.params

        const user = await Users.findOne({"tokens.token": token, "tokens.type": "forgotPassword"})

        if(!user) return res.status(401).json({message: "Password reset token is invalid"})

        user.password = password
        user.tokens = user.tokens.filter(t => t.token !== token);
        await user.save()

        res.status(200).json({message: "Password has been reset"});

    }catch(e){
        res.status(500).send({error: e.message})
    }
})

// Get User Profile
router.get("/profile", jwtAuthMiddleware, async(req, res) => {
    try {
        const userId = req.jwtPayload.userData
        const user = await Users.findById(userId)

        if(!user) return res.status(404).json({error: 'User not found'})

        res.status(200).json({user})
    }catch(e) {
        res.status(500).send({error: e.message})
    }
})

// Update User Password
router.patch("/profile/password", jwtAuthMiddleware, async(req, res) => {
    try {
        const userId = req.jwtPayload.userData
        const {currentPassword, newPassword} = req.body

        // Validate required fields
        if (!currentPassword || !newPassword) {
            return res.status(400).send("All fields are required");
        }

        // Find user and check current password
        const user = await Users.findById(userId)
        const isMatch = await bcrypt.compare(currentPassword, user.password)
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect Password' });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.status(200).json({ message: 'Password changed successfully' });

    }catch (e) {
        res.status(500).json({error: e.message})
    }
})

// Enable/Disable Two Factor Authentication
router.get("/toggle-2fa", jwtAuthMiddleware, async(req, res) => {
    try{

        const userId = req.jwtPayload.userData
        const user = await Users.findById(userId)

        if(!user) return res.status(404).json({error: 'User not found'})

        // Enable/Disable 2fa
        user.is2faEnabled = !user.is2faEnabled
        await user.save();

        res.status(200).json({
            message: user.is2faEnabled ? 'Two factor authentication enabled successfully' : 'Two factor authentication disabled successfully'
        })
    }catch(e){
        res.status(500).json({error: e.message})
    }
})



module.exports = router