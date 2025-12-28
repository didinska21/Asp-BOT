/**
 * ALLSCALE AUTO REGISTER
 * - VPS Ready (headless mode)
 * - Proxy support (static/rotating)
 * - Temp email (1secmail.com)
 * - Auto save accounts
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const readline = require('readline');
const { getTempEmail, getOTP } = require('./tempmail');
const { sleep, saveAccount, log } = require('./utils');

puppeteer.use(StealthPlugin());

// Load config
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Interactive proxy selection
async function selectProxy() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\n========== PROXY SELECTION ==========');
    console.log('1. No Proxy');
    console.log('2. Static Proxy');
    console.log('3. Rotating Proxy');
    console.log('=====================================\n');
    
    rl.question('Choose proxy option (1/2/3): ', (answer) => {
      rl.close();
      
      const choice = answer.trim();
      
      if (choice === '1') {
        resolve({ mode: 'none', proxy: null });
      } else if (choice === '2') {
        const proxy = config.proxy.static;
        if (!proxy || proxy.includes('user:pass')) {
          console.log('⚠️  Static proxy not configured in config.json');
          resolve({ mode: 'none', proxy: null });
        } else {
          resolve({ mode: 'static', proxy });
        }
      } else if (choice === '3') {
        const proxy = config.proxy.rotating;
        if (!proxy || proxy.includes('user:pass')) {
          console.log('⚠️  Rotating proxy not configured in config.json');
          resolve({ mode: 'none', proxy: null });
        } else {
          resolve({ mode: 'rotating', proxy });
        }
      } else {
        console.log('Invalid choice, using no proxy');
        resolve({ mode: 'none', proxy: null });
      }
    });
  });
}

async function register() {
  let browser;
  
  try {
    log('🚀 Starting registration...');
    
    // Select proxy interactively
    const { mode, proxy } = await selectProxy();
    
    // Browser args
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ];
    
    // Add proxy if selected
    if (proxy) {
      args.push(`--proxy-server=${proxy}`);
      log(`🌐 Using ${mode} proxy: ${proxy}`);
    } else {
      log('🌐 No proxy');
    }
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      args,
      defaultViewport: { width: 1280, height: 720 }
    });
    
    const page = await browser.newPage();
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Get temp email
    log('📧 Getting temp email...');
    const emailData = await getTempEmail();
    log(`📧 Email: ${emailData.email}`);
    
    // Go to register page with referral
    const registerUrl = `https://app.allscale.io/pay/register?code=${config.referral_code}`;
    log(`🌍 Opening: ${registerUrl}`);
    
    await page.goto(registerUrl, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    await sleep(3000);
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'step1-loaded.png' });
    log('📸 Screenshot saved: step1-loaded.png');
    
    // Input email
    log('✍️ Typing email...');
    const emailInput = await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await emailInput.click();
    await sleep(500);
    await emailInput.type(emailData.email, { delay: 100 });
    
    await sleep(1000);
    
    // Check all checkboxes
    log('✅ Checking checkboxes...');
    const checkedCount = await page.evaluate(() => {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      let count = 0;
      checkboxes.forEach(cb => {
        if (!cb.checked) {
          cb.click();
          count++;
        }
      });
      return count;
    });
    log(`✅ Checked ${checkedCount} checkboxes`);
    
    await sleep(1000);
    await page.screenshot({ path: 'step2-filled.png' });
    
    // Find and click submit button
    log('🔘 Looking for submit button...');
    const buttonClicked = await page.evaluate(() => {
      // Try different button texts
      const texts = ['create with email', 'sign up', 'register', 'continue'];
      const buttons = Array.from(document.querySelectorAll('button'));
      
      for (const text of texts) {
        const btn = buttons.find(b => 
          b.innerText.toLowerCase().includes(text) ||
          b.textContent.toLowerCase().includes(text)
        );
        if (btn && !btn.disabled) {
          btn.click();
          return text;
        }
      }
      return null;
    });
    
    if (buttonClicked) {
      log(`✅ Clicked button: "${buttonClicked}"`);
    } else {
      log('⚠️ Button not found, trying Enter...');
      await page.keyboard.press('Enter');
    }
    
    await sleep(3000);
    await page.screenshot({ path: 'step3-submitted.png' });
    
    // Wait for OTP input
    log('⏳ Waiting for OTP input field...');
    await page.waitForSelector('input[inputmode="numeric"], input[type="text"][maxlength="6"]', { 
      timeout: 30000 
    });
    
    log('🔐 Getting OTP from email...');
    const otp = await getOTP(emailData);
    log(`🔐 OTP: ${otp}`);
    
    // Input OTP
    log('✍️ Entering OTP...');
    const otpEntered = await page.evaluate((code) => {
      // Method 1: Individual inputs
      const inputs = document.querySelectorAll('input[inputmode="numeric"]');
      if (inputs.length === code.length) {
        inputs.forEach((input, i) => {
          input.value = code[i];
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        return 'individual';
      }
      
      // Method 2: Single input
      const singleInput = document.querySelector('input[type="text"][maxlength="6"]');
      if (singleInput) {
        singleInput.value = code;
        singleInput.dispatchEvent(new Event('input', { bubbles: true }));
        return 'single';
      }
      
      return null;
    }, otp);
    
    log(`✅ OTP entered using: ${otpEntered}`);
    
    await sleep(2000);
    await page.screenshot({ path: 'step4-otp.png' });
    
    // Auto-submit or press Enter
    await page.keyboard.press('Enter');
    
    await sleep(5000);
    await page.screenshot({ path: 'step5-final.png' });
    
    // Check if success
    const currentUrl = page.url();
    log(`📍 Final URL: ${currentUrl}`);
    
    if (currentUrl.includes('dashboard') || currentUrl.includes('home') || !currentUrl.includes('register')) {
      log('✅ REGISTRATION SUCCESS!');
      saveAccount(emailData.email, config.referral_code);
      return true;
    } else {
      log('⚠️ Registration may have failed - check screenshots');
      return false;
    }
    
  } catch (err) {
    log(`❌ ERROR: ${err.message}`);
    console.error(err);
    
    if (browser) {
      await browser.pages().then(pages => 
        pages[0]?.screenshot({ path: 'error.png' }).catch(() => {})
      );
    }
    
    return false;
  } finally {
    if (browser) {
      await sleep(2000);
      await browser.close();
    }
  }
}

// Run
(async () => {
  const success = await register();
  process.exit(success ? 0 : 1);
})();
