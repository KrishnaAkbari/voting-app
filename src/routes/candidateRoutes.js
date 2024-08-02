const express = require("express")
const router = new express.Router()
const {jwtAuthMiddleware} = require('../jwt')

const Candidate = require("../models/candidates")
const Users = require("../models/users")


// Check user role
const checkAdminRole = async(userID) => {
    const user = await Users.findById(userID)
    return user.role === 'admin'
}

// Add a Candidate
router.post('/', jwtAuthMiddleware, async(req, res) => {
    try{

        // Check if user has admin role
        if(! await checkAdminRole(req.jwtPayload.userData)){
            return res.status(403).json({message: 'User does not have admin role'})
        }

        const { name, party, age } = req.body;
        
        // Validate required fields
        if (!name || !age || !party) {
            return res.status(400).send("All fields are required");
        }

        // Create a new candidate
        const newCandidate = new Candidate({ name, party, age });
        const savedCandidate = await newCandidate.save();

        res.status(201).json({savedCandidate});

    }catch(e){
        res.status(500).json({error: e})
    }
})

// List Candidates
router.get('/', async(req, res) => {
    try {

        const { query } = req.query
        let candidates;

        if(query){
            // Search candidate by name or party
            candidates = await Candidate.find({
                $or: [
                    { name: {$regex: query, $options: 'i'} },
                    { party: {$regex: query, $options: 'i'} }
                ]
            })
        }
        else{
            // Find all candidates
            candidates = await Candidate.find()
        }

        res.status(200).json({candidates: candidates})
        
    } catch (e) {
        res.status(500).json({error: e})
    }
})

// Update candidate
router.patch("/:candidateId", jwtAuthMiddleware, async(req, res) => {
    try {

        // Check if user has admin role
        if(! await checkAdminRole(req.jwtPayload.userData)){
            return res.status(403).json({message: 'User does not have admin role'})
        }
        const candidateId = req.params.candidateId
        const updateCandidateData = req.body

        // Update candidate
        const updatedData = await Candidate.findByIdAndUpdate(candidateId, updateCandidateData, {
            new: true // Return updated document
        })

        if(!updatedData){
            return res.status(404).json({message: 'Candidate not found'})
        }

        res.status(200).json({candidate: updatedData, message: "Candidate updated successfully"})

    }catch (e) {
        res.status(500).json({error: e})
    }
})

// Delete candidate
router.delete("/:candidateId", jwtAuthMiddleware, async(req, res) => {
    try {

        // Check if user has admin role
        if(! await checkAdminRole(req.jwtPayload.userData)){
            return res.status(403).json({message: 'User does not have admin role'})
        }
        const candidateId = req.params.candidateId

        // Delete candidate
        const deletedData = await Candidate.findByIdAndDelete(candidateId)

        if(!deletedData){
            return res.status(404).json({message: 'Candidate not found'})
        }

        res.status(200).json({candidate: deletedData, message: "Candidate deleted successfully"})

    }catch (e) {
        res.status(500).json({error: e})
    }
})

// Vote
router.post('/vote/:candidateID', jwtAuthMiddleware, async(req, res) => {

    const candidateId = req.params.candidateID
    const userId = req.jwtPayload.userData

    try{

        // Find Candidate
        const candidate = await Candidate.findById(candidateId)
        if(!candidate){
            return res.status(404).json({message: "Candidate not found"})
        }
        
        // Find User
        const user = await Users.findById(userId)
        if(!user){
            return res.status(404).json({message: "User not found"})
        }
    
        // Check if user has already voted
        if(user.isVoted){
            return res.status(400).json({message: "You have already voted"})
        }
        
        // Admin is not allowed to vote
        if(user.role === 'admin'){
            return res.status(403).json({message: "Admin is not allowed to vote"})
        }

        if(!user.isEmailVerified){
            return res.status(400).json({message: "Email not verified. Please verify your email before voting."})
        }
    
        // Update the candidate document to record the vote
        candidate.votes.push({user: userId})
        candidate.voteCount++
        candidate.save()
    
        // Update User document
        user.isVoted = true
        user.save()

        res.status(200).json({message: "Vote recorded successfully"})

    }catch(e){
        res.status(500).json({error: e})
    }

})

// Vote count
router.get('/vote/count', async(req, res) => {
    try {

        // Find all candidates and sort then by voteCount in descending order
        const candidates = await Candidate.find().sort({voteCount: 'desc'})

        // Map candidates to retrieve party and voteCount only
        const voteRecord = candidates.map(candidate => {
            return{
                party: candidate.party,
                count: candidate.voteCount
            }
        }) 

        res.status(200).json(voteRecord)
        
    } catch (e) {
        res.status(500).json({error: e})
    }
})

module.exports = router