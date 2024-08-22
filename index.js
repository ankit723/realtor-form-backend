
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const mongoose = require('mongoose');
const app = express();
const port = 8000;

mongoose.connect(process.env.MONGODB_URI, { })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

app.use(cors());
app.use(express.json());

const formSchema = new mongoose.Schema({
  name: String,
  config: String,
  visitTiming: String,
  phone: String,
});

const Form = mongoose.model('Form', formSchema);

const otpStore = {};

const Message = (sendPhone, otp, msg = `OTP for Verification: ${otp}`) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken) {
      console.error("Twilio Account SID and Auth Token must be set in the .env file");
      return;
    }

    const client = twilio(accountSid, authToken);

    client.messages
      .create({
        body: msg,
        from: phone,
        to: sendPhone
      })
      .then(message => console.log(message.sid))
      .catch(error => console.error("Error sending message:", error));
};

app.post('/api/send-otp', (req, res) => {
    const { phoneNumber } = req.body;
    
    const otp = Math.floor(100000 + Math.random() * 900000);
    console.log(phoneNumber, otp)
    otpStore[phoneNumber] = { otp, expiryTime: Date.now() + 300000 };
    Message("+91" + phoneNumber, otp);
    res.status(200).json({ message: 'OTP sent successfully' });
});

app.post('/api/verify-otp', (req, res) => {
    const { phoneNumber, otp } = req.body;
  
    if (!phoneNumber || !otp) {
        return res.status(400).json({ verified: false, message: 'Phone number and OTP are required' });
    }
    const otpEntry = otpStore[phoneNumber];
    if (!otpEntry) {
        return res.status(400).json({ verified: false, message: 'No OTP found for this phone number' });
    }
    const { otp: storedOtp, expiryTime } = otpEntry;
    if (Date.now() > expiryTime) {
        delete otpStore[phoneNumber];
        return res.status(400).json({ verified: false, message: 'OTP has expired' });
    }
    const isVerified = (parseInt(otp) === parseInt(storedOtp));
    if (isVerified) {
        delete otpStore[phoneNumber];
    }
    res.status(isVerified ? 200 : 400).json({ verified: isVerified, message: isVerified ? 'OTP verified' : 'OTP verification failed' });
});

app.post('/api/submit-form', async (req, res) => {
    const { name, config, visitTiming, phone } = req.body;
    console.log(name, config, visitTiming, phone)
    if (!name || !config || !visitTiming || !phone) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const form = new Form({ name, config, visitTiming, phone });
        await form.save();
        res.status(200).json({ message: 'Form data saved successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to save form data' });
    }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

