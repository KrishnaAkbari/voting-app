const jwt = require("jsonwebtoken")
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware to authenticate JWT token from the request headers
*/

const jwtAuthMiddleware = (req, res, next) => {

    // Check if the authorization header is present
    const authorization = req.headers.authorization
    if(!authorization) return res.status(401).json({error: 'Token Not Found'})

    // Extract the JWT token from the authorization header
    const token = authorization.split(' ')[1]
    if(!token) return res.status(401).json({error: 'Unauthorized'})

    try{
        // Verify the JWT token
        const decoded = jwt.verify(token, JWT_SECRET)
        req.jwtPayload = decoded
        next()

    }catch(e){
        res.status(401).json({error: 'Invalid Token'})
    }
}

// Function to generate a new JWT token using user data
const generateToken = (userData) => {
    return jwt.sign({userData}, JWT_SECRET, {expiresIn: '24h'}) // Token expires in 24 hours
}

module.exports = {jwtAuthMiddleware, generateToken}