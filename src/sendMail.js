require('dotenv').config();

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
    },
});

const sendMail = async (email, subject, html) => {
    try{
        let info = await transporter.sendMail({
            from: 'test@gmail.com', // sender address
            to: email, // list of receivers
            subject: subject, // Subject line
            html: html, // plain text body
        })
    }catch(e){
        console.log(e)
    }

}

module.exports = sendMail