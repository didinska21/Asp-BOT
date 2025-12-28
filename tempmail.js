/**
 * TEMP EMAIL HANDLER
 * Using 1secmail.com (free, no API key)
 */

const axios = require('axios');

const API_BASE = 'https://www.1secmail.com/api/v1/';

// Generate random email
async function getTempEmail() {
  try {
    const res = await axios.get(`${API_BASE}?action=genRandomMailbox&count=1`);
    return res.data[0];
  } catch (err) {
    throw new Error(`Failed to get temp email: ${err.message}`);
  }
}

// Get OTP from email
async function getOTP(email, maxRetries = 30) {
  const [login, domain] = email.split('@');
  
  console.log('⏳ Waiting for OTP email (max 3 minutes)...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Get inbox
      const res = await axios.get(`${API_BASE}?action=getMessages&login=${login}&domain=${domain}`);
      const messages = res.data;
      
      if (messages && messages.length > 0) {
        // Get latest message
        const msgId = messages[0].id;
        const msgRes = await axios.get(`${API_BASE}?action=readMessage&login=${login}&domain=${domain}&id=${msgId}`);
        const body = msgRes.data.textBody || msgRes.data.body || '';
        
        // Extract OTP (6 digits)
        const otpMatch = body.match(/\b(\d{6})\b/);
        if (otpMatch) {
          return otpMatch[1];
        }
        
        // Try alternative patterns
        const altMatch = body.match(/code[:\s]+(\d{6})/i) || 
                        body.match(/verification[:\s]+(\d{6})/i) ||
                        body.match(/otp[:\s]+(\d{6})/i);
        if (altMatch) {
          return altMatch[1];
        }
      }
      
      // Wait 6 seconds before retry
      await new Promise(r => setTimeout(r, 6000));
      
      if ((i + 1) % 5 === 0) {
        console.log(`⏳ Still waiting... (${i + 1}/${maxRetries})`);
      }
      
    } catch (err) {
      // Ignore errors, keep retrying
    }
  }
  
  throw new Error('OTP not received after 3 minutes');
}

module.exports = { getTempEmail, getOTP };
