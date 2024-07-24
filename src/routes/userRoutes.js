const express = require("express")
const bcrypt = require("bcryptjs")
const crypto = require('crypto');
const router = new express.Router()

const sendMail = require("../sendMail")

const Users = require("../models/users")
const {jwtAuthMiddleware, generateToken} = require('../jwt')

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
        const newUser = new Users({ name, email, age, mobile, address, aadharcardNumber, password, role, emailVerificationToken });
        const savedUser = await newUser.save();

        // Generate token and save it to the user
        const token = generateToken(savedUser._id)
        savedUser.tokens = savedUser.tokens.concat({ token });
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
        const user = await Users.findOne({emailVerificationToken: token})
        if(!user){
            return res.status(404).json({ message: 'Token not valid or expired' });
        }

        user.isEmailVerified = true
        user.emailVerificationToken = ''
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

module.exports = router