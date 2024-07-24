require('dotenv').config();

const bcrypt = require("bcryptjs")
const mongoose = require("mongoose")

// Define the User schema
const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
    },
    age:{
        type: Number,
        required: true
    },
    mobile: {
        type: String
    },
    address: {
        type: String,
        required: true
    },
    aadharcardNumber: {
        type: Number,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['voter', 'admin'],
        default: 'voter'
    },
    isVoted: {
        type: Boolean,
        default: false
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken:{
        type: String
    },
    tokens: [{
        token:{
            type: String,
            required: true
        }
    }]  
})

// Pre-save hook to hash the password before saving the user document
userSchema.pre("save", async function(next){
    try{
        // Only hash the password if it has been modified (or is new)
        if(this.isModified("password")) {
            this.password = await bcrypt.hash(this.password, 10);
        }
        next();
    }catch (error) {
        next(error);
    }
})

// Create the User model from the schema
const Users = new mongoose.model("User", userSchema)

module.exports = Users