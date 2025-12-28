const axios = require("axios");

function randomString(length = 8) {
  return Math.random().toString(36).substring(2, 2 + length);
}

async function createTempEmail() {
  const login = randomString(10);
  const domain = "1secmail.com";
  return {
    email: `${login}@${domain}`,
    login,
    domain
  };
}

async function waitForOTP(login, domain, timeout = 120000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const { data } = await axios.get(
      `https://www.1secmail.com/api/v1/?action=getMessages&login=${login}&domain=${domain}`
    );

    if (data.length > 0) {
      const mailId = data[0].id;
      const mail = await axios.get(
        `https://www.1secmail.com/api/v1/?action=readMessage&login=${login}&domain=${domain}&id=${mailId}`
      );

      const body = mail.data.body;
      const otp = body.match(/\b\d{6}\b/);
      if (otp) return otp[0];
    }

    await new Promise(r => setTimeout(r, 5000));
  }

  throw new Error("OTP timeout");
}

module.exports = {
  createTempEmail,
  waitForOTP
};
