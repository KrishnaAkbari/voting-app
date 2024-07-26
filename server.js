require('dotenv').config();

// Establish connection to the database
require("./src/db/connection")

const express = require("express");
const app = express()

// Middleware to parse JSON bodies
app.use(express.json())

const port = process.env.PORT || 3000

// Import user and candidate routes
const userRoutes = require("./src/routes/userRoutes")
const candidateRoutes = require("./src/routes/candidateRoutes")

// Use the imported routes with appropriate base paths
app.use('/user', userRoutes)
app.use('/candidate', candidateRoutes)

app.listen(port, () => {
    console.log(`Listening to port ${port}`)
})