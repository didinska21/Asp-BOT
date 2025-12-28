/**
 * UTILITY FUNCTIONS
 */

const fs = require('fs');

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Log with timestamp
function log(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${timestamp}] ${message}`);
}

// Save account to file
function saveAccount(email, referralCode) {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} | ${email} | Ref: ${referralCode}\n`;
  
  fs.appendFileSync('accounts.txt', line);
  log('💾 Account saved to accounts.txt');
}

module.exports = { sleep, log, saveAccount };
