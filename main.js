// ===================================================================
// AUTO REFERRAL BOT - ALLSCALE.IO
// De-obfuscated Version for Educational Purpose Only
// ===================================================================

const inquirer = require('inquirer');
const fs = require('fs');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const cfonts = require('cfonts');
const UserAgent = require('user-agents');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const cbor = require('cbor');

// ===================================================================
// COLOR CONSTANTS
// ===================================================================
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const WHITE = '\x1b[37m';

// ===================================================================
// SPINNER ANIMATION
// ===================================================================
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function createSpinner(message) {
  let frameIndex = 0;
  let interval = null;
  let isRunning = false;

  function clearLine() {
    try {
      process.stdout.moveCursor(0, -1);
      process.stdout.cursorTo(0);
    } catch (error) {}
  }

  return {
    start() {
      if (isRunning) return;
      isRunning = true;
      clearLine();
      process.stdout.write(`${CYAN}${SPINNER_FRAMES[frameIndex]} ${message}${RESET}`);
      
      interval = setInterval(() => {
        frameIndex = (frameIndex + 1) % SPINNER_FRAMES.length;
        clearLine();
        process.stdout.write(`${CYAN}${SPINNER_FRAMES[frameIndex]} ${message}${RESET}`);
      }, 100);
    },

    succeed(successMessage) {
      if (!isRunning) return;
      clearInterval(interval);
      isRunning = false;
      clearLine();
      process.stdout.write(`\x1b[32m\x1b[1m✔ ${successMessage}${RESET}\n`);
    },

    fail(errorMessage) {
      if (!isRunning) return;
      clearInterval(interval);
      isRunning = false;
      clearLine();
      process.stdout.write(`${RED}✖ ${errorMessage}${RESET}\n`);
    },

    stop() {
      if (!isRunning) return;
      clearInterval(interval);
      isRunning = false;
      clearLine();
    }
  };
}

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================
function centerText(text) {
  const terminalWidth = process.stdout.columns || 80;
  const textLength = text.replace(/\x1b\[[0-9;]*m/g, '').length;
  const padding = Math.max(0, Math.floor((terminalWidth - textLength) / 2));
  return ' '.repeat(padding) + text;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function countdown(milliseconds, prefix = 'Waiting') {
  const seconds = Math.floor(milliseconds / 1000);
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`${YELLOW}\r${prefix} ${i} seconds...${RESET}`);
    await delay(1000);
  }
  process.stdout.write('\r' + ' '.repeat(50) + '\r');
}

function readProxiesFromFile(filename) {
  try {
    const content = fs.readFileSync(filename, 'utf8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '');
  } catch (error) {
    console.log(`${RED}Gagal membaca file proxy.txt: ${error.message}${RESET}`);
    return [];
  }
}

// ===================================================================
// BANNER
// ===================================================================
cfonts.say('ALLSCALE', {
  font: 'block',
  align: 'center',
  colors: ['cyan', 'magenta']
});

console.log(centerText(`${BLUE}═════════════════════════════════${RESET}`));
console.log(centerText(`${CYAN}✪ BOT AUTO REFERRAL ASP ✪${RESET}\n`));
