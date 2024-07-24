require('dotenv').config();

const mongoose = require("mongoose")

// Define the candidate schema
const candidateSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    party: {
        type: String,
        required: true 
    },
    age: {
        type: Number,
        required: true
    },
    votes: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User', // Referencing the User model for the voter
                required: true
            },
            votedAt: {
                type: Date,
                default: Date.now()
            }
        }
    ],
    voteCount: {
        type: Number,
        default: 0
    }
})

// Create the Candidates model from the schema
const Candidates = new mongoose.model("Candidate", candidateSchema)

module.exports = Candidates