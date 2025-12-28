/**
 * ALLSCALE REGISTER – FINAL
 * - Auto Xvfb (VPS safe)
 * - Referral from config.json
 * - Proxy choice by number
 * - Real browser + stealth
 */

/// ===== AUTO XVFB (ANTI LUPA) =====
if (!process.env.DISPLAY && !process.env.XVFB_RUN) {
  const { spawn } = require("child_process");
  console.log("⚠️ No DISPLAY detected, restarting with xvfb...");

  spawn(
    "xvfb-run",
    ["-a", "node", process.argv[1]],
    {
      stdio: "inherit",
      env: { ...process.env, XVFB_RUN: "1" }
    }
  );

  process.exit(0);
}

/// ===== DEPENDENCIES =====
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const readline = require("readline-sync");
const fs = require("fs");

const { createTempEmail, waitForOTP } = require("./email");
const { loadProxy } = require("./proxy");
const { logError } = require("./logger");

puppeteer.use(StealthPlugin());

(async () => {
  try {
    /// ===== LOAD CONFIG =====
    const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
    const referral = config.referral_code || "";

    let registerUrl = "https://app.allscale.io/pay/register";
    if (referral) registerUrl += `?code=${referral}`;

    /// ===== PROXY MENU =====
    console.log("\nPILIH PROXY:");
    console.log("1. Tanpa Proxy");
    console.log("2. Proxy Static");
    console.log("3. Proxy Rotating");

    const choice = readline.question("Pilih (1/2/3): ").trim();

    let proxy = null;
    if (choice === "2") proxy = loadProxy("static");
    if (choice === "3") proxy = loadProxy("rotating");

    console.log("🌐 Proxy:", proxy || "NONE");

    /// ===== BROWSER ARGS =====
    const args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-gpu",
      "--disable-dev-shm-usage"
    ];

    if (proxy) args.push(`--proxy-server=${proxy}`);

    /// ===== LAUNCH BROWSER =====
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args
    });

    const page = await browser.newPage();

    /// ===== PROXY AUTH (IF ANY) =====
    if (proxy && proxy.includes("@")) {
      const auth = proxy.split("//")[1].split("@")[0].split(":");
      await page.authenticate({
        username: auth[0],
        password: auth[1]
      });
    }

    /// ===== TEMP EMAIL =====
    const { email, login, domain } = await createTempEmail();
    console.log("📧 Temp Email:", email);

    /// ===== OPEN REGISTER PAGE =====
    await page.goto(registerUrl, { waitUntil: "networkidle2" });

    /// ===== FILL FORM =====
    await page.waitForSelector('input[type="email"]', { timeout: 30000 });
    await page.type('input[type="email"]', email, { delay: 80 });

    const checkboxes = await page.$$('input[type="checkbox"]');
    for (const cb of checkboxes) {
      await cb.click();
    }

    // klik "Create with email" (bukan passkey)
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")]
        .find(b => b.innerText.toLowerCase().includes("create with email"));
      if (btn) btn.click();
    });

    console.log("⏳ Waiting OTP...");

    /// ===== WAIT OTP =====
    const otp = await waitForOTP(login, domain);
    console.log("🔐 OTP:", otp);

    /// ===== INPUT OTP =====
    await page.waitForSelector('input[inputmode="numeric"]', { timeout: 30000 });
    const inputs = await page.$$('input[inputmode="numeric"]');

    for (let i = 0; i < otp.length && i < inputs.length; i++) {
      await inputs[i].type(otp[i], { delay: 120 });
    }

    console.log("✅ REGISTER SUCCESS");

  } catch (err) {
    logError("REGISTER_MAIN", err);
    console.log("❌ REGISTER FAILED – cek error.log");
  }
})();
