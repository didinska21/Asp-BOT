// bot.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from 'dotenv';
import axios from 'axios';

config();

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ===== TEMP MAIL CLIENTS =====
// Mail.tm - Reliable temp mail service
async function createMailTmClient() {
  const baseURL = 'https://api.mail.tm';
  
  // Generate random email
  const randomString = Math.random().toString(36).substring(2, 10);
  
  // Get available domains
  const domainsRes = await axios.get(`${baseURL}/domains`);
  const domain = domainsRes.data['hydra:member'][0].domain;
  
  const email = `${randomString}@${domain}`;
  const password = Math.random().toString(36).substring(2, 15);
  
  // Create account
  await axios.post(`${baseURL}/accounts`, {
    address: email,
    password: password
  });
  
  // Get token
  const tokenRes = await axios.post(`${baseURL}/token`, {
    address: email,
    password: password
  });
  
  const token = tokenRes.data.token;
  
  return {
    email,
    token,
    baseURL,
    
    async checkEmail() {
      try {
        const res = await axios.get(`${baseURL}/messages`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        return res.data['hydra:member'] || [];
      } catch (e) {
        return [];
      }
    },
    
    async getEmailBody(emailId) {
      const res = await axios.get(`${baseURL}/messages/${emailId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return res.data;
    }
  };
}

// TempMail.lol - Simple fallback
async function createTempMailLolClient() {
  const baseURL = 'https://api.tempmail.lol';
  
  // Generate inbox
  const response = await axios.post(`${baseURL}/generate/rush`, {}, {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const email = response.data.address;
  const token = response.data.token;

  return {
    email,
    token,
    
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

// ===== CLOUDFLARE BYPASS =====
async function waitForCloudflareBypass(page, timeout = 60000) {
  console.log('⏳ Menunggu Cloudflare bypass...');
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const title = await page.title();
      const url = page.url();
      
      // Cek apakah masih di halaman Cloudflare
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

// ===== MAIN REGISTRATION FUNCTION =====
async function registerAllscale() {
  const referralCode = process.env.REFERRAL_CODE;
  const proxyString = process.env.PROXY; // format: user:pass@hostname:port
  
  if (!referralCode) {
    throw new Error('REFERRAL_CODE tidak ditemukan di .env');
  }

  let browser;
  let emailClient;

  try {
    // Setup Temp Mail dengan fallback
    console.log('📧 Setup email temporary...');
    let emailClient;
    let email;
    
    try {
      console.log('⏳ Mencoba Mail.tm...');
      emailClient = await createMailTmClient();
      email = emailClient.email;
      console.log(`✅ Email generated (Mail.tm): ${email}`);
    } catch (e) {
      console.log('⚠️ Mail.tm gagal, mencoba TempMail.lol...');
      try {
        emailClient = await createTempMailLolClient();
        email = emailClient.email;
        console.log(`✅ Email generated (TempMail.lol): ${email}`);
      } catch (e2) {
        throw new Error('Semua email provider gagal');
      }
    }

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
      ]
    };

    // Tambahkan proxy jika ada
    if (proxyString && proxyString.trim() !== '') {
      try {
        const [auth, hostPort] = proxyString.split('@');
        const [user, pass] = auth.split(':');
        const [hostname, port] = hostPort.split(':');
        
        launchOptions.args.push(`--proxy-server=http://${hostname}:${port}`);
        console.log(`🌐 Menggunakan proxy: ${hostname}:${port}`);
      } catch (proxyError) {
        console.log('⚠️ Format proxy salah, melanjutkan tanpa proxy');
      }
    } else {
      console.log('ℹ️ Tidak menggunakan proxy');
    }

    console.log('🚀 Meluncurkan browser...');
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Authenticate proxy jika ada
    if (proxyString && proxyString.trim() !== '') {
      try {
        const [auth] = proxyString.split('@');
        const [user, pass] = auth.split(':');
        await page.authenticate({ username: user, password: pass });
        console.log('✅ Proxy authentication berhasil');
      } catch (authError) {
        console.log('⚠️ Proxy authentication gagal, melanjutkan...');
      }
    }

    // Set viewport dan user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Buka halaman register
    const registerUrl = `https://app.allscale.io/pay/register?code=${referralCode}`;
    console.log(`🌐 Membuka: ${registerUrl}`);
    await page.goto(registerUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Bypass Cloudflare
    await waitForCloudflareBypass(page);
    await delay(2000);

    // Screenshot untuk debugging
    await page.screenshot({ path: 'step1-loaded.png' });

    // Tunggu dan isi email
    console.log('📝 Mengisi form email...');
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 });
    await delay(1000);
    
    const emailInput = await page.$('input[type="email"], input[name="email"]');
    await emailInput.click({ clickCount: 3 });
    await emailInput.type(email, { delay: 100 });
    
    await delay(1000);
    await page.screenshot({ path: 'step2-email-filled.png' });

    // CEK DAN CENTANG CHECKBOX TERMS/PRIVACY
    console.log('🔍 Mencari dan centang checkbox...');
    const checkboxFound = await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      let found = false;
      
      for (const cb of checkboxes) {
        const parent = cb.closest('label') || cb.parentElement;
        const text = parent?.textContent.toLowerCase() || '';
        
        console.log('Checkbox found:', text.substring(0, 100));
        
        if (text.includes('agree') || text.includes('terms') || 
            text.includes('privacy') || text.includes('policy')) {
          if (!cb.checked) {
            cb.click();
            found = true;
            console.log('✓ Checkbox clicked');
          }
        }
      }
      return found;
    });
    
    if (checkboxFound) {
      console.log('✅ Checkbox terms dicentang');
      await delay(1500);
      await page.screenshot({ path: 'step2b-checkbox.png' });
    } else {
      console.log('⚠️ Checkbox tidak ditemukan atau sudah tercentang');
    }

    // DEBUGGING: Cek semua button yang ada
    console.log('🔍 Mencari semua button di halaman...');
    const buttons = await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
      return allButtons.map((btn, idx) => ({
        index: idx,
        text: btn.textContent.trim().substring(0, 50),
        disabled: btn.disabled,
        visible: btn.offsetParent !== null,
        className: btn.className
      }));
    });
    
    console.log('📋 Buttons ditemukan:');
    buttons.forEach(btn => {
      console.log(`   [${btn.index}] "${btn.text}" - disabled:${btn.disabled}, visible:${btn.visible}`);
    });

    // Cari button "Create with Email" yang BUKAN disabled
    console.log('🎯 Mencari button "Create with Email"...');
    const buttonClicked = await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
      
      for (const btn of allButtons) {
        const text = btn.textContent.toLowerCase().trim();
        
        // Debug setiap button
        console.log(`Checking button: "${text.substring(0, 30)}", disabled: ${btn.disabled}`);
        
        if (text.includes('create with email') || 
            (text.includes('create') && text.includes('email'))) {
          
          if (btn.disabled) {
            console.log('Button found but DISABLED:', text);
            return false;
          }
          
          console.log('Clicking button:', text);
          btn.click();
          return true;
        }
      }
      return false;
    });
    
    if (buttonClicked) {
      console.log('✅ Button "Create with Email" diklik!');
    } else {
      console.log('⚠️ Button DISABLED atau tidak ditemukan!');
      console.log('💡 Kemungkinan: Email belum valid atau checkbox belum dicentang');
    }

    await delay(3000);
    await page.screenshot({ path: 'step3-after-click.png' });

    // Cek perubahan halaman dengan lebih detail
    console.log('🔍 Mengecek perubahan halaman...');
    const currentUrl = page.url();
    const pageContent = await page.evaluate(() => document.body.innerText);
    
    console.log(`📍 Current URL: ${currentUrl}`);
    console.log('📄 Page keywords:', {
      hasRegister: pageContent.includes('Create your account'),
      hasVerification: pageContent.includes('verification') || pageContent.includes('Verification'),
      hasCode: pageContent.includes('code') || pageContent.includes('Code'),
      hasOTP: pageContent.includes('OTP') || pageContent.includes('otp'),
      hasEmail: pageContent.includes('Check your email')
    });

    // Jika halaman tidak berubah, coba click dengan cara lain
    if (pageContent.includes('Create your account') && !pageContent.includes('verification')) {
      console.log('⚠️ Halaman masih di register form!');
      console.log('🔄 Mencoba metode alternatif...');
      
      // Method alternatif: Scroll dan tunggu button enabled
      await page.evaluate(() => window.scrollBy(0, 300));
      await delay(2000);
      
      // Coba lagi dengan force click
      const forceClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        for (const btn of buttons) {
          const text = btn.textContent.toLowerCase();
          if (text.includes('email') && !text.includes('passkey')) {
            // Force click bahkan jika disabled
            btn.disabled = false;
            btn.click();
            
            // Trigger events manually
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return true;
          }
        }
        return false;
      });
      
      if (forceClicked) {
        console.log('✅ Force click berhasil');
        await delay(3000);
      }
    }

    await page.screenshot({ path: 'step4-final-state.png' });

    // Tunggu OTP dari email
    console.log('📬 Menunggu OTP dari email...');
    let otp = null;
    let attempts = 0;
    const maxAttempts = 40;

    while (!otp && attempts < maxAttempts) {
      await delay(3000);
      attempts++;
      
      try {
        const emails = await emailClient.checkEmail();
        console.log(`📨 Cek email attempt ${attempts}/${maxAttempts}... (${emails.length} email)`);
        
        if (emails && emails.length > 0) {
          for (const mail of emails) {
            const from = mail.from?.address || mail.from || 'unknown';
            const subject = mail.subject || mail.title || 'no subject';
            console.log(`   📧 From: ${from}, Subject: ${subject}`);
            
            let body = '';
            if (mail.id) {
              try {
                const fullMail = await emailClient.getEmailBody(mail.id);
                body = fullMail.text || fullMail.intro || fullMail.body || fullMail.html || '';
              } catch (e) {
                body = mail.intro || mail.text || '';
              }
            } else {
              body = mail.text || mail.intro || mail.body || '';
            }
            
            console.log(`   📄 Body: ${body.substring(0, 150)}...`);
            
            const patterns = [
              /\b(\d{6})\b/,
              /code.*?(\d{6})/i,
              /otp.*?(\d{6})/i,
              /verification.*?(\d{6})/i,
              /(\d{3}[\s-]?\d{3})/,
            ];
            
            for (const pattern of patterns) {
              const otpMatch = body.match(pattern);
              if (otpMatch) {
                otp = otpMatch[1].replace(/[\s-]/g, '');
                console.log(`✅ OTP ditemukan: ${otp}`);
                break;
              }
            }
            
            if (otp) break;
          }
        }
      } catch (emailError) {
        console.log(`⚠️ Error: ${emailError.message}`);
      }
    }

    if (!otp) {
      console.log('❌ OTP tidak ditemukan.');
      console.log('💡 Kemungkinan penyebab:');
      console.log('   1. Button submit DISABLED karena validasi gagal');
      console.log('   2. Email tidak valid untuk website ini');
      console.log('   3. Checkbox terms belum tercentang dengan benar');
      console.log('📸 Cek screenshot step4-final-state.png untuk detail');
      throw new Error('OTP tidak ditemukan - form mungkin belum ter-submit');
    }

    // Input OTP
    console.log('🔢 Memasukkan OTP...');
    await delay(2000);
    
    const otpInputs = await page.$$('input[type="text"], input[type="number"]');
    
    if (otpInputs.length === 1) {
      await otpInputs[0].type(otp, { delay: 100 });
    } else if (otpInputs.length >= 6) {
      for (let i = 0; i < 6; i++) {
        await otpInputs[i].type(otp[i], { delay: 100 });
      }
    } else {
      throw new Error('Format input OTP tidak dikenali');
    }

    await delay(2000);
    await page.screenshot({ path: 'step5-otp-filled.png' });

    // Submit OTP
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

    // Tunggu konfirmasi
    console.log('⏳ Menunggu konfirmasi...');
    await delay(5000);
    await page.screenshot({ path: 'step6-final.png' });

    const finalUrl = page.url();
    console.log(`📍 URL final: ${finalUrl}`);

    if (finalUrl.includes('dashboard') || finalUrl.includes('home') || !finalUrl.includes('register')) {
      console.log('🎉 Registrasi berhasil!');
      console.log(`📧 Email: ${email}`);
    } else {
      console.log('⚠️ Status tidak pasti, cek screenshot');
    }

    await delay(3000);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (browser) {
      const pages = await browser.pages();
      if (pages[0]) {
        await pages[0].screenshot({ path: 'error-screenshot.png' });
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
registerAllscale().catch(console.error);
