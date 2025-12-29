// bot2.js - FIXED VERSION with Sticky Proxy Support
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from 'dotenv';
import axios from 'axios';

config();

process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min, max) =>
  delay(Math.floor(Math.random() * (max - min + 1)) + min);

// ===== ENHANCED STEALTH FUNCTIONS =====
async function setupEnhancedStealth(page) {
  await page.evaluateOnNewDocument(() => {
    delete navigator.__proto__.webdriver;

    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    window.chrome = { runtime: {} };

    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters)
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
  const randomString = Math.random().toString(36).substring(2, 10);

  await axios.post(`${baseURL}/inbox/create`, {
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

// ===== EMAIL PROVIDER MANAGER =====
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

// ===== ENHANCED PROXY HANDLER WITH STICKY SESSION =====
function parseProxy(proxyString) {
  if (!proxyString || proxyString.trim() === '') {
    return null;
  }

  try {
    const hasAuth = proxyString.includes('@');

    if (hasAuth) {
      const [auth, hostPort] = proxyString.split('@');
      let [username, password] = auth.split(':');
      const [hostname, port] = hostPort.split(':');

      if (!hostname || !port) {
        throw new Error('Invalid proxy format');
      }

      // 🔥 STICKY SESSION AUTO-DETECTION & GENERATION
      const needsSticky = username.toLowerCase().includes('session') || 
                         username.toLowerCase().includes('sticky');
      
      let sessionId = null;
      
      // Jika username sudah punya format session
      if (username.includes('-session-')) {
        const parts = username.split('-session-');
        sessionId = parts[1] || Math.random().toString(36).substring(2, 10);
      } 
      // Jika perlu sticky tapi belum ada session ID
      else if (needsSticky) {
        sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        username = `${username}-session-${sessionId}`;
      }

      const isSticky = needsSticky || sessionId !== null;

      if (isSticky) {
        console.log(`🔒 Sticky proxy detected`);
        console.log(`   Session ID: ${sessionId}`);
      }

      return {
        server: `${hostname}:${port}`,
        username,
        password,
        isSticky,
        sessionId,
        rawString: `${username}:${password}@${hostname}:${port}`
      };
    } else {
      const [hostname, port] = proxyString.split(':');

      if (!hostname || !port) {
        throw new Error('Invalid proxy format');
      }

      return {
        server: `${hostname}:${port}`,
        username: null,
        password: null,
        isSticky: false,
        sessionId: null,
        rawString: proxyString
      };
    }
  } catch (error) {
    console.error('❌ Error parsing proxy:', error.message);
    console.log('💡 Format proxy yang benar:');
    console.log('   - Rotating: user:pass@hostname:port');
    console.log('   - Sticky (auto): user-session:pass@hostname:port');
    console.log('   - Sticky (manual): user-session-abc123:pass@hostname:port');
    console.log('   - Provider format: follow your provider docs');
    return null;
  }
}

// ===== PROXY CONSISTENCY TEST =====
async function testProxyConsistency(page, proxyConfig) {
  if (!proxyConfig) {
    console.log('ℹ️ Skip proxy test (no proxy configured)');
    return true;
  }

  console.log('🧪 Testing proxy consistency...');
  
  const ips = [];
  const testUrl = 'https://api.ipify.org?format=json';
  
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(testUrl, { 
        waitUntil: 'networkidle2',
        timeout: 15000 
      });
      
      const ipData = await page.evaluate(() => {
        try {
          return JSON.parse(document.body.innerText);
        } catch {
          return { ip: 'parse-error' };
        }
      });
      
      if (ipData.ip && ipData.ip !== 'parse-error') {
        ips.push(ipData.ip);
        console.log(`   Test ${i+1}/3: ${ipData.ip}`);
      }
      
      await delay(2000);
    } catch (err) {
      console.log(`   Test ${i+1}/3: Failed (${err.message})`);
    }
  }
  
  if (ips.length === 0) {
    console.log('⚠️ Proxy test gagal - tidak bisa detect IP');
    return false;
  }
  
  const uniqueIPs = [...new Set(ips)];
  const isConsistent = uniqueIPs.length === 1;
  
  if (isConsistent) {
    console.log(`✅ Proxy CONSISTENT: ${ips[0]}`);
    console.log(`   Type: ${proxyConfig.isSticky ? 'STICKY' : 'STATIC'}`);
    return true;
  } else {
    console.log('⚠️ WARNING: Proxy ROTATING detected!');
    console.log(`   IPs found: ${uniqueIPs.join(', ')}`);
    console.log('   Cloudflare bypass kemungkinan GAGAL');
    console.log('   Gunakan sticky/static proxy untuk success rate tinggi');
    return false;
  }
}

// ===== CLOUDFLARE BYPASS =====
async function waitForCloudflareBypass(page, timeout = 60000) {
  console.log('⏳ Menunggu Cloudflare bypass...');
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const title = await page.title();
      const url = page.url();

      if (
        !title.includes('Just a moment') &&
        !url.includes('cdn-cgi/challenge-platform')
      ) {
        console.log('✅ Cloudflare bypass berhasil!');
        return true;
      }

      await delay(1000);
    } catch (error) {
      console.log('⚠️ Error checking Cloudflare:', error.message);
    }
  }

  throw new Error('Cloudflare bypass timeout');
}

async function waitForTurnstileComplete(page, timeout = 180000) {
  console.log('🛡️ Menunggu Cloudflare Turnstile...');
  const startTime = Date.now();
  let lastStrategy = '';

  while (Date.now() - startTime < timeout) {
    try {
      const turnstileState = await page.evaluate(() => {
        const iframe = document.querySelector(
          'iframe[src*="cloudflare"], iframe[src*="turnstile"]'
        );
        if (!iframe) return 'no_turnstile';

        const verifyingText = document.body.innerText.toLowerCase();
        if (verifyingText.includes('verifying')) return 'verifying';

        return 'has_turnstile';
      });

      if (turnstileState === 'no_turnstile') {
        console.log('✅ Turnstile selesai / tidak ada');
        return true;
      }

      if (turnstileState === 'verifying' && lastStrategy !== 'mouse') {
        console.log('🖱️ Simulasi mouse...');
        await humanMouseMove(page);
        lastStrategy = 'mouse';
      }

      const success = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return (
          text.includes('verify to receive') ||
          text.includes('enter the code') ||
          text.includes('check your email')
        );
      });

      if (success) {
        console.log('✅ Turnstile passed');
        return true;
      }

      await delay(2000);
    } catch (error) {
      console.log('⚠️ Turnstile check error:', error.message);
      await delay(2000);
    }
  }

  console.log('⚠️ Turnstile timeout');
  return false;
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
  const customEmail = process.env.CUSTOM_EMAIL;

  if (!referralCode) {
    throw new Error('REFERRAL_CODE tidak ditemukan di .env');
  }

  let browser;
  let emailClient;

  try {
    // ===== SETUP EMAIL =====
    console.log('📧 Setup email...');
    let email;

    if (customEmail && customEmail.trim() !== '') {
      email = customEmail;
      console.log(`✅ Menggunakan custom email: ${email}`);
      console.log('⚠️ OTP harus dicek manual');

      emailClient = {
        email,
        provider: 'Custom',
        async checkEmail() {
          console.log('💡 Silakan cek inbox email Anda');
          return [];
        }
      };
    } else {
      emailClient = await createEmailClient();
      email = emailClient.email;
    }

    // ===== PROXY PARSING =====
    const proxyConfig = parseProxy(proxyString);

    if (proxyConfig) {
      console.log('🌐 Proxy Configuration:');
      console.log(`   Server: ${proxyConfig.server}`);
      console.log(`   Type: ${proxyConfig.isSticky ? '🔒 STICKY' : '🔄 ROTATING/STATIC'}`);
      if (proxyConfig.sessionId) {
        console.log(`   Session: ${proxyConfig.sessionId}`);
      }
      
      if (!proxyConfig.isSticky) {
        console.log('');
        console.log('⚠️  WARNING: Proxy tidak sticky!');
        console.log('   Cloudflare Turnstile mungkin gagal');
        console.log('   Recommendation: gunakan sticky proxy');
        console.log('');
      }
    } else {
      console.log('ℹ️ Tidak menggunakan proxy');
    }

    // ===== LAUNCH OPTIONS =====
    const launchOptions = {
      headless: 'new',
      executablePath: '/usr/bin/google-chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--window-size=1280,800',
        '--disable-infobars',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    };

    if (proxyConfig) {
      launchOptions.args.push(`--proxy-server=${proxyConfig.server}`);
    }

    // ===== LAUNCH BROWSER =====
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

    // ===== STEALTH SETUP =====
    await setupEnhancedStealth(page);
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    // ===== PROXY CONSISTENCY TEST =====
    const proxyOK = await testProxyConsistency(page, proxyConfig);
    
    if (!proxyOK && proxyConfig && !proxyConfig.isSticky) {
      console.log('');
      console.log('⏸️  Proxy rotating terdeteksi!');
      console.log('   Lanjut dalam 5 detik... (Ctrl+C untuk cancel)');
      console.log('');
      await delay(5000);
    }

    // ===== OPEN REGISTER PAGE =====
    const registerUrl = `https://app.allscale.io/pay/register?code=${referralCode}`;
    console.log(`🌐 Membuka: ${registerUrl}`);

    await page.goto(registerUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await waitForCloudflareBypass(page);
    await randomDelay(2000, 4000);
    await humanMouseMove(page);
    await page.screenshot({ path: 'step1-loaded.png' });

    // ===== FILL EMAIL =====
    console.log('📝 Mengisi email...');
    await page.waitForSelector('input[type="email"], input[name="email"]', {
      timeout: 30000
    });

    const emailInput = await page.$('input[type="email"], input[name="email"]');
    await emailInput.click({ clickCount: 3 });
    await randomDelay(300, 600);

    for (const char of email) {
      await emailInput.type(char, { delay: Math.random() * 50 + 50 });
    }

    await randomDelay(1000, 2000);
    await page.screenshot({ path: 'step2-email-filled.png' });

    // ===== CHECK TERMS =====
    console.log('🔍 Mencari checkbox terms...');
    const checkboxFound = await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      let found = false;

      for (const cb of checkboxes) {
        const parent = cb.closest('label') || cb.parentElement;
        const text = parent?.textContent.toLowerCase() || '';

        if (
          text.includes('agree') ||
          text.includes('terms') ||
          text.includes('privacy') ||
          text.includes('policy')
        ) {
          if (!cb.checked) {
            cb.click();
            found = true;
          }
        }
      }
      return found;
    });

    if (checkboxFound) {
      console.log('✅ Checkbox dicentang');
      await randomDelay(1000, 2000);
      await page.screenshot({ path: 'step2b-checkbox.png' });
    }

    // ===== CLICK CREATE =====
    console.log('🔍 Mencari tombol Create with Email...');
    let clickAttempts = 0;
    let buttonClicked = false;

    while (!buttonClicked && clickAttempts < 3) {
      clickAttempts++;

      buttonClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));

        for (const btn of buttons) {
          const text = btn.textContent.toLowerCase().trim();

          if (
            text.includes('create with email') ||
            (text.includes('create') && text.includes('email'))
          ) {
            if (btn.disabled) return false;
            btn.click();
            return true;
          }
        }
        return false;
      });

      if (!buttonClicked) {
        console.log(`⚠️ Attempt ${clickAttempts}: retry klik tombol...`);
        await randomDelay(1500, 2500);
      }
    }

    if (!buttonClicked) {
      throw new Error('Tombol Create with Email gagal diklik');
    }

    console.log('✅ Tombol Create with Email diklik');
    await randomDelay(3000, 5000);
    await page.screenshot({ path: 'step3-after-click.png' });

    // ===== TURNSTILE =====
    console.log('🛡️ Menangani Cloudflare Turnstile...');
    const turnstileSuccess = await waitForTurnstileComplete(page, 180000);

    if (!turnstileSuccess) {
      console.log('⚠️ Turnstile timeout, lanjut...');
    }

    console.log('⏳ Menunggu email OTP (15 detik)...');
    await delay(15000);
    await page.screenshot({ path: 'step4-post-turnstile.png' });

    // ===== VERIFY PAGE CHECK =====
    const isVerificationPage = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return (
        text.includes('verify to receive') ||
        text.includes('enter the code') ||
        text.includes('check your email')
      );
    });

    if (!isVerificationPage) {
      console.log('⚠️ Belum sampai halaman verifikasi');
      console.log(`📧 Email: ${email}`);
      console.log(`🔧 Provider: ${emailClient.provider}`);
      
      if (proxyConfig && !proxyConfig.isSticky) {
        console.log('');
        console.log('💡 KEMUNGKINAN PENYEBAB:');
        console.log('   ❌ Proxy rotating - IP berubah saat Turnstile');
        console.log('   ✅ Solusi: gunakan sticky/static proxy');
      }
      
      throw new Error('Gagal sampai halaman verifikasi OTP');
    }

    console.log('✅ Berhasil sampai halaman verifikasi!');
    console.log(`📧 Email: ${email}`);
    console.log(`🔧 Provider: ${emailClient.provider}`);

    // ===== WAIT OTP =====
    console.log('📬 Menunggu OTP dari email (max 5 menit)...');
    let otp = null;
    let attempts = 0;
    const maxAttempts = 100;

    while (!otp && attempts < maxAttempts) {
      await delay(3000);
      attempts++;

      try {
        const emails = await emailClient.checkEmail();

        if (attempts % 10 === 0) {
          console.log(
            `📨 Cek email attempt ${attempts}/${maxAttempts} (${emails.length} email)`
          );
        }

        if (emails && emails.length > 0) {
          for (const mail of emails) {
            const from = mail.from?.address || mail.from || 'unknown';
            const subject = mail.subject || mail.title || 'no subject';

            let body = '';

            if (mail.id && emailClient.getEmailBody) {
              try {
                const fullMail = await emailClient.getEmailBody(mail.id);
                body =
                  fullMail.text ||
                  fullMail.intro ||
                  fullMail.body ||
                  fullMail.html ||
                  '';
              } catch {
                body = mail.text || mail.intro || mail.body || '';
              }
            } else {
              body =
                mail.text ||
                mail.intro ||
                mail.body ||
                mail.mail_body ||
                '';
            }

            const fullText = `${subject} ${body}`;
            otp = extractOTP(fullText);

            if (otp) {
              console.log(`✅ OTP ditemukan: ${otp}`);
              break;
            }
          }
        }
      } catch (emailError) {
        console.log(`⚠️ Error cek email: ${emailError.message}`);
      }
    }

    if (!otp) {
      console.log('❌ OTP tidak ditemukan');
      console.log('💡 Saran:');
      console.log('   - Ganti provider email');
      console.log('   - Gunakan CUSTOM_EMAIL');
      throw new Error('OTP tidak diterima');
    }

    // ===== INPUT OTP =====
    console.log('🔢 Memasukkan OTP...');
    await randomDelay(2000, 3000);

    const otpInputs = await page.$$(
      'input[type="text"], input[type="number"], input[inputmode="numeric"]'
    );

    if (otpInputs.length === 1) {
      await otpInputs[0].type(otp, { delay: 100 });
    } else if (otpInputs.length >= 6) {
      for (let i = 0; i < 6; i++) {
        await otpInputs[i].type(otp[i], { delay: 100 });
      }
    } else {
      throw new Error('Input OTP tidak dikenali');
    }

    await randomDelay(2000, 3000);
    await page.screenshot({ path: 'step5-otp-filled.png' });

    // ===== SUBMIT OTP =====
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

    // ===== FINAL CHECK =====
    console.log('⏳ Menunggu konfirmasi akhir...');
    await delay(5000);
    await page.screenshot({ path: 'step6-final.png' });

    const finalUrl = page.url();
    console.log(`📍 URL final: ${finalUrl}`);

    if (
      finalUrl.includes('dashboard') ||
      finalUrl.includes('home') ||
      !finalUrl.includes('register')
    ) {
      console.log('\n🎉 REGISTRASI BERHASIL! 🎉');
      console.log(`📧 Email: ${email}`);
      console.log(`🔧 Provider: ${emailClient.provider}`);
      console.log(`🔗 Referral Code: ${referralCode}`);
      if (proxyConfig) {
        console.log(`🌐 Proxy: ${proxyConfig.server} (${proxyConfig.isSticky ? 'STICKY' : 'STATIC'})`);
      }
    } else {
      console.log('⚠️ Status tidak pasti, cek screenshot step6-final.png');
    }

    await delay(3000);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);

    if (browser) {
      try {
        const pages = await browser.pages();
        if (pages[0]) {
          await pages[0].screenshot({ path: 'error-screenshot.png' });
          console.log('📸 Error screenshot saved');
        }
      } catch {}
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// ===== RUN BOT =====
console.log('🤖 AllScale Auto Register Bot v2.0 - STICKY PROXY EDITION');
console.log('🛡️ Enhanced: Proxy Test + Stealth + Multi Email');
console.log('📧 Providers: Mail.tm, TempMail.lol, GuerrillaMail, 10MinuteMail, TempMail.plus, Mohmal');
console.log('🔒 Sticky Proxy: AUTO-DETECT & SESSION MANAGEMENT\n');

registerAllscale().catch(error => {
  console.error('\n💥 Bot failed:', error.message);
  process.exit(1);
});
