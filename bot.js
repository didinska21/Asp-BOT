// bot.js - Ultimate Version with Multiple Email Providers
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from 'dotenv';
import axios from 'axios';

config();

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min, max) => delay(Math.floor(Math.random() * (max - min + 1)) + min);

// ===== ENHANCED STEALTH FUNCTIONS =====
async function setupEnhancedStealth(page) {
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    
    window.chrome = {
      runtime: {},
    };
    
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });
}

async function humanMouseMove(page) {
  const dimensions = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }));
  
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(Math.random() * dimensions.width);
    const y = Math.floor(Math.random() * dimensions.height);
    await page.mouse.move(x, y, { steps: 10 });
    await randomDelay(100, 300);
  }
}

// ===== MULTIPLE TEMP MAIL PROVIDERS =====

// 1. Mail.tm
async function createMailTmClient() {
  const baseURL = 'https://api.mail.tm';
  
  const randomString = Math.random().toString(36).substring(2, 10);
  
  const domainsRes = await axios.get(`${baseURL}/domains`);
  const domain = domainsRes.data['hydra:member'][0].domain;
  
  const email = `${randomString}@${domain}`;
  const password = Math.random().toString(36).substring(2, 15);
  
  await axios.post(`${baseURL}/accounts`, {
    address: email,
    password: password
  });
  
  const tokenRes = await axios.post(`${baseURL}/token`, {
    address: email,
    password: password
  });
  
  const token = tokenRes.data.token;
  
  return {
    email,
    token,
    baseURL,
    provider: 'Mail.tm',
    
    async checkEmail() {
      try {
        const res = await axios.get(`${baseURL}/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return res.data['hydra:member'] || [];
      } catch (e) {
        return [];
      }
    },
    
    async getEmailBody(emailId) {
      const res = await axios.get(`${baseURL}/messages/${emailId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.data;
    }
  };
}

// 2. TempMail.lol
async function createTempMailLolClient() {
  const baseURL = 'https://api.tempmail.lol';
  
  const response = await axios.post(`${baseURL}/generate/rush`, {}, {
    headers: { 'Content-Type': 'application/json' }
  });

  const email = response.data.address;
  const token = response.data.token;

  return {
    email,
    token,
    provider: 'TempMail.lol',
    
    async checkEmail() {
      try {
        const res = await axios.get(`${baseURL}/auth/${token}`);
        return res.data.email || [];
      } catch (e) {
        return [];
      }
    }
  };
}

// 3. Guerrilla Mail
async function createGuerrillaMailClient() {
  const baseURL = 'https://api.guerrillamail.com/ajax.php';
  
  // Get email address
  const response = await axios.get(`${baseURL}?f=get_email_address`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  
  const email = response.data.email_addr;
  const sidToken = response.data.sid_token;
  
  return {
    email,
    sidToken,
    provider: 'GuerrillaMail',
    
    async checkEmail() {
      try {
        const res = await axios.get(`${baseURL}?f=check_email&sid_token=${this.sidToken}&seq=0`);
        return res.data.list || [];
      } catch (e) {
        return [];
      }
    },
    
    async getEmailBody(emailId) {
      const res = await axios.get(`${baseURL}?f=fetch_email&sid_token=${this.sidToken}&email_id=${emailId}`);
      return res.data;
    }
  };
}

// 4. 10MinuteMail
async function create10MinuteMailClient() {
  const baseURL = 'https://10minutemail.net';
  
  // Generate session
  const response = await axios.get(`${baseURL}/address.api.php`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  
  const email = response.data.mail_get_mail;
  
  return {
    email,
    provider: '10MinuteMail',
    
    async checkEmail() {
      try {
        const res = await axios.get(`${baseURL}/address.api.php`);
        return res.data.mail_list || [];
      } catch (e) {
        return [];
      }
    }
  };
}

// 5. TempMail.plus
async function createTempMailPlusClient() {
  const baseURL = 'https://tempmail.plus/api/mails';
  
  // Generate random email
  const randomString = Math.random().toString(36).substring(2, 10);
  const email = `${randomString}@tempmail.plus`;
  
  return {
    email,
    provider: 'TempMail.plus',
    
    async checkEmail() {
      try {
        const emailHash = Buffer.from(this.email).toString('base64');
        const res = await axios.get(`${baseURL}?email=${emailHash}`);
        return res.data || [];
      } catch (e) {
        return [];
      }
    }
  };
}

// 6. Mohmal
async function createMohmalClient() {
  const baseURL = 'https://www.mohmal.com/en/api';
  
  // Generate random inbox
  const randomString = Math.random().toString(36).substring(2, 10);
  
  const response = await axios.post(`${baseURL}/inbox/create`, {
    username: randomString
  });
  
  const email = `${randomString}@mohmal.com`;
  
  return {
    email,
    username: randomString,
    provider: 'Mohmal',
    
    async checkEmail() {
      try {
        const res = await axios.get(`${baseURL}/inbox/${this.username}`);
        return res.data.messages || [];
      } catch (e) {
        return [];
      }
    }
  };
}

// Email Provider Manager with Cascade Fallback
async function createEmailClient() {
  const providers = [
    { name: 'Mail.tm', fn: createMailTmClient },
    { name: 'TempMail.lol', fn: createTempMailLolClient },
    { name: 'GuerrillaMail', fn: createGuerrillaMailClient },
    { name: '10MinuteMail', fn: create10MinuteMailClient },
    { name: 'TempMail.plus', fn: createTempMailPlusClient },
    { name: 'Mohmal', fn: createMohmalClient },
  ];
  
  for (const provider of providers) {
    try {
      console.log(`⏳ Mencoba ${provider.name}...`);
      const client = await provider.fn();
      console.log(`✅ Email generated (${provider.name}): ${client.email}`);
      return client;
    } catch (error) {
      console.log(`⚠️ ${provider.name} gagal: ${error.message}`);
    }
  }
  
  throw new Error('Semua email provider gagal');
}

// ===== CLOUDFLARE BYPASS =====
async function waitForCloudflareBypass(page, timeout = 60000) {
  console.log('⏳ Menunggu Cloudflare bypass...');
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const title = await page.title();
      const url = page.url();
      
      if (!title.includes('Just a moment') && 
          !url.includes('cdn-cgi/challenge-platform')) {
        console.log('✅ Cloudflare bypass berhasil!');
        return true;
      }
      
      await delay(1000);
    } catch (error) {
      console.log('Error checking Cloudflare:', error.message);
    }
  }
  
  throw new Error('Cloudflare bypass timeout');
}

async function waitForTurnstileComplete(page, timeout = 180000) {
  console.log('🛡️ Menunggu Cloudflare Turnstile dengan smart detection...');
  const startTime = Date.now();
  let lastStrategy = '';
  
  while (Date.now() - startTime < timeout) {
    try {
      const turnstileState = await page.evaluate(() => {
        const iframe = document.querySelector('iframe[src*="cloudflare"], iframe[src*="turnstile"]');
        if (!iframe) return 'no_turnstile';
        
        const verifyingText = document.body.innerText.toLowerCase();
        if (verifyingText.includes('verifying')) return 'verifying';
        
        return 'has_turnstile';
      });
      
      if (turnstileState === 'no_turnstile') {
        console.log('✅ Turnstile tidak ditemukan atau sudah selesai');
        return true;
      }
      
      if (turnstileState === 'verifying' && lastStrategy !== 'mouse_move') {
        console.log('🖱️ Simulasi gerakan mouse...');
        await humanMouseMove(page);
        lastStrategy = 'mouse_move';
      }
      
      const hasSuccessIndicators = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes('verify to receive') || 
               text.includes('enter the code') ||
               text.includes('check your email');
      });
      
      if (hasSuccessIndicators) {
        console.log('✅ Turnstile berhasil - halaman verifikasi muncul');
        return true;
      }
      
      const currentUrl = page.url();
      if (!currentUrl.includes('register') && !currentUrl.includes('challenge')) {
        console.log('✅ Turnstile berhasil - URL berubah');
        return true;
      }
      
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (elapsed % 10 === 0) {
        console.log(`⏱️ Turnstile progress: ${elapsed}s / ${timeout/1000}s`);
      }
      
      await delay(2000);
      
    } catch (error) {
      console.log('⚠️ Error checking Turnstile:', error.message);
      await delay(2000);
    }
  }
  
  console.log('⚠️ Turnstile timeout, melanjutkan...');
  return false;
}

// ===== PROXY HANDLER =====
function parseProxy(proxyString) {
  if (!proxyString || proxyString.trim() === '') {
    return null;
  }
  
  try {
    const hasAuth = proxyString.includes('@');
    
    if (hasAuth) {
      const [auth, hostPort] = proxyString.split('@');
      const [username, password] = auth.split(':');
      const [hostname, port] = hostPort.split(':');
      
      if (!hostname || !port) {
        throw new Error('Invalid proxy format');
      }
      
      return {
        server: `${hostname}:${port}`,
        username,
        password
      };
    } else {
      const [hostname, port] = proxyString.split(':');
      
      if (!hostname || !port) {
        throw new Error('Invalid proxy format');
      }
      
      return {
        server: `${hostname}:${port}`,
        username: null,
        password: null
      };
    }
  } catch (error) {
    console.error('❌ Error parsing proxy:', error.message);
    console.log('💡 Format proxy yang benar:');
    console.log('   - Dengan auth: user:pass@hostname:port');
    console.log('   - Tanpa auth: hostname:port');
    return null;
  }
}

// ===== ENHANCED OTP DETECTION =====
function extractOTP(text) {
  if (!text) return null;
  
  const patterns = [
    /\b(\d{6})\b/,
    /code.*?(\d{6})/i,
    /otp.*?(\d{6})/i,
    /verification.*?(\d{6})/i,
    /(\d{3}[\s-]?\d{3})/,
    /your code is[:\s]*(\d{6})/i,
    /allscale.*?(\d{6})/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].replace(/[\s-]/g, '');
    }
  }
  
  return null;
}

// ===== MAIN REGISTRATION FUNCTION =====
async function registerAllscale() {
  const referralCode = process.env.REFERRAL_CODE;
  const proxyString = process.env.PROXY;
  const customEmail = process.env.CUSTOM_EMAIL; // Optional: untuk email pribadi
  
  if (!referralCode) {
    throw new Error('REFERRAL_CODE tidak ditemukan di .env');
  }

  let browser;
  let emailClient;

  try {
    // Setup Email
    console.log('📧 Setup email...');
    let email;
    
    if (customEmail && customEmail.trim() !== '') {
      // Use custom email if provided
      email = customEmail;
      console.log(`✅ Menggunakan custom email: ${email}`);
      console.log('⚠️ CATATAN: Anda harus cek email manual untuk OTP!');
      
      // Create dummy client for custom email
      emailClient = {
        email: customEmail,
        provider: 'Custom',
        async checkEmail() {
          console.log('💡 Cek inbox email Anda secara manual');
          return [];
        }
      };
    } else {
      // Use temp email with cascade fallback
      emailClient = await createEmailClient();
      email = emailClient.email;
    }

    // Parse proxy
    const proxyConfig = parseProxy(proxyString);

    // Browser options
    const launchOptions = {
      headless: 'new',
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--window-size=1280,800',
        '--disable-infobars',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ]
    };

    if (proxyConfig) {
      launchOptions.args.push(`--proxy-server=${proxyConfig.server}`);
      console.log(`🌐 Menggunakan proxy: ${proxyConfig.server}`);
    } else {
      console.log('ℹ️ Tidak menggunakan proxy');
    }

    console.log('🚀 Meluncurkan browser...');
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    if (proxyConfig && proxyConfig.username && proxyConfig.password) {
      await page.authenticate({ 
        username: proxyConfig.username, 
        password: proxyConfig.password 
      });
      console.log('✅ Proxy authentication berhasil');
    }

    await setupEnhancedStealth(page);

    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    const registerUrl = `https://app.allscale.io/pay/register?code=${referralCode}`;
    console.log(`🌐 Membuka: ${registerUrl}`);
    await page.goto(registerUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    await waitForCloudflareBypass(page);
    await randomDelay(2000, 4000);

    await humanMouseMove(page);

    await page.screenshot({ path: 'step1-loaded.png' });

    console.log('📝 Mengisi form email...');
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 });
    await randomDelay(800, 1500);
    
    const emailInput = await page.$('input[type="email"], input[name="email"]');
    await emailInput.click({ clickCount: 3 });
    await randomDelay(300, 600);
    
    for (const char of email) {
      await emailInput.type(char, { delay: Math.random() * 50 + 50 });
    }
    
    await randomDelay(1000, 2000);
    await page.screenshot({ path: 'step2-email-filled.png' });

    console.log('🔍 Mencari dan centang checkbox...');
    const checkboxFound = await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      let found = false;
      
      for (const cb of checkboxes) {
        const parent = cb.closest('label') || cb.parentElement;
        const text = parent?.textContent.toLowerCase() || '';
        
        if (text.includes('agree') || text.includes('terms') || 
            text.includes('privacy') || text.includes('policy')) {
          if (!cb.checked) {
            cb.click();
            found = true;
          }
        }
      }
      return found;
    });
    
    if (checkboxFound) {
      console.log('✅ Checkbox terms dicentang');
      await randomDelay(1000, 2000);
      await page.screenshot({ path: 'step2b-checkbox.png' });
    }

    console.log('🔍 Mencari button "Create with Email"...');
    let clickAttempts = 0;
    let buttonClicked = false;
    
    while (!buttonClicked && clickAttempts < 3) {
      clickAttempts++;
      
      buttonClicked = await page.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
        
        for (const btn of allButtons) {
          const text = btn.textContent.toLowerCase().trim();
          
          if (text.includes('create with email') || 
              (text.includes('create') && text.includes('email'))) {
            
            if (btn.disabled) {
              return false;
            }
            
            btn.click();
            return true;
          }
        }
        return false;
      });
      
      if (!buttonClicked) {
        console.log(`⚠️ Attempt ${clickAttempts}: Button tidak ditemukan atau disabled, retry...`);
        await randomDelay(1500, 2500);
      }
    }
    
    if (buttonClicked) {
      console.log('✅ Button "Create with Email" diklik!');
    } else {
      throw new Error('Button tidak bisa diklik setelah 3 attempts');
    }

    await randomDelay(3000, 5000);
    await page.screenshot({ path: 'step3-after-click.png' });

    console.log('🛡️ Menangani Cloudflare Turnstile...');
    const turnstileSuccess = await waitForTurnstileComplete(page, 180000);
    
    if (!turnstileSuccess) {
      console.log('⚠️ Turnstile mungkin tidak selesai sempurna, tapi melanjutkan...');
    }
    
    // WAIT LONGER for email to be sent by Allscale
    console.log('⏳ Menunggu Allscale mengirim email (15 detik)...');
    await delay(15000);
    
    await page.screenshot({ path: 'step4-post-turnstile.png' });

    const isVerificationPage = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes('verify to receive') || 
             text.includes('enter the code') ||
             text.includes('check your email');
    });
    
    if (!isVerificationPage) {
      console.log('⚠️ Belum sampai halaman verifikasi');
      console.log(`💡 Provider: ${emailClient.provider}`);
      console.log(`📧 Email: ${email}`);
      throw new Error('Gagal melewati Turnstile - tidak sampai halaman verifikasi');
    }
    
    console.log('✅ Berhasil sampai halaman verifikasi!');
    console.log(`📧 Email yang digunakan: ${email}`);
    console.log(`🔧 Provider: ${emailClient.provider}`);

    // Enhanced OTP waiting with longer timeout
    console.log('📬 Menunggu OTP dari email (max 5 menit)...');
    let otp = null;
    let attempts = 0;
    const maxAttempts = 100; // 5 minutes

    while (!otp && attempts < maxAttempts) {
      await delay(3000);
      attempts++;
      
      try {
        const emails = await emailClient.checkEmail();
        
        if (attempts % 10 === 0) {
          console.log(`📨 Cek email attempt ${attempts}/${maxAttempts}... (${emails.length} email) [${emailClient.provider}]`);
        }
        
        if (emails && emails.length > 0) {
          for (const mail of emails) {
            const from = mail.from?.address || mail.from || 'unknown';
            const subject = mail.subject || mail.title || 'no subject';
            console.log(`   📧 From: ${from}`);
            console.log(`   📌 Subject: ${subject}`);
            
            let body = '';
            
            if (mail.id && emailClient.getEmailBody) {
              try {
                const fullMail = await emailClient.getEmailBody(mail.id);
                body = fullMail.text || fullMail.intro || fullMail.body || fullMail.html || '';
              } catch (e) {
                body = mail.intro || mail.text || mail.body || '';
              }
            } else {
              body = mail.text || mail.intro || mail.body || mail.mail_body || '';
            }
            
            // Combine subject and body for better OTP detection
            const fullText = `${subject} ${body}`;
            console.log(`   📄 Content: ${fullText.substring(0, 200)}...`);
            
            otp = extractOTP(fullText);
            
            if (otp) {
              console.log(`✅ OTP ditemukan: ${otp}`);
              break;
            }
          }
        }
        
        if (otp) break;
        
      } catch (emailError) {
        console.log(`⚠️ Error cek email: ${emailError.message}`);
      }
    }

    if (!otp) {
      console.log('❌ OTP tidak ditemukan setelah 5 menit.');
      console.log('💡 Kemungkinan penyebab:');
      console.log(`   1. Domain ${emailClient.provider} diblokir oleh Allscale`);
      console.log('   2. Email butuh waktu lebih lama untuk sampai');
      console.log('   3. Coba gunakan CUSTOM_EMAIL di .env');
      console.log('\n📝 Untuk menggunakan email pribadi:');
      console.log('   CUSTOM_EMAIL=your-email@gmail.com');
      throw new Error('OTP tidak diterima');
    }

    console.log('🔢 Memasukkan OTP...');
    await randomDelay(2000, 3000);
    
    const otpInputs = await page.$$('input[type="text"], input[type="number"], input[inputmode="numeric"]');
    
    if (otpInputs.length === 1) {
      await otpInputs[0].type(otp, { delay: 100 });
    } else if (otpInputs.length >= 6) {
      for (let i = 0; i < 6; i++) {
        await otpInputs[i].type(otp[i], { delay: 100 });
      }
    } else {
      throw new Error('Format input OTP tidak dikenali');
    }

    await randomDelay(2000, 3000);
    await page.screenshot({ path: 'step5-otp-filled.png' });

    const verifyButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => 
        btn.textContent.toLowerCase().includes('verify') ||
        btn.textContent.toLowerCase().includes('confirm') ||
        btn.textContent.toLowerCase().includes('submit')
      );
    });

    if (verifyButton) {
      await verifyButton.click();
      console.log('✅ OTP submitted');
    }

    console.log('⏳ Menunggu konfirmasi...');
    await delay(5000);
    await page.screenshot({ path: 'step6-final.png' });

    const finalUrl = page.url();
    console.log(`📍 URL final: ${finalUrl}`);

    if (finalUrl.includes('dashboard') || finalUrl.includes('home') || !finalUrl.includes('register')) {
      console.log('\n🎉 REGISTRASI BERHASIL! 🎉');
      console.log(`📧 Email: ${email}`);
      console.log(`🔧 Provider: ${emailClient.provider}`);
      console.log(`🔗 Referral Code: ${referralCode}`);
    } else {
      console.log('⚠️ Status tidak pasti, cek screenshot step6-final.png');
    }

    await delay(3000);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    
    if (browser) {
      const pages = await browser.pages();
      if (pages[0]) {
        await pages[0].screenshot({ path: 'error-screenshot.png' });
        console.log('📸 Error screenshot saved: error-screenshot.png');
      }
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// ===== JALANKAN BOT =====
console.log('🤖 AllScale Auto Register Bot - Ultimate Version');
console.log('🛡️ With Multiple Email Providers & Enhanced Bypass');
console.log('📧 Supported: Mail.tm, TempMail.lol, GuerrillaMail, 10MinuteMail, TempMail.plus, Mohmal\n');

registerAllscale().catch(error => {
  console.error('\n💥 Bot failed:', error.message);
  process.exit(1);
});
