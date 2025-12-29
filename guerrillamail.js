// guerrillamail.js
import axios from 'axios';

export async function createGuerrillaMailClient() {
  const baseURL = 'https://api.guerrillamail.com/ajax.php';
  
  // Get email address
  const response = await axios.get(baseURL, {
    params: {
      f: 'get_email_address',
      ip: '127.0.0.1',
      agent: 'Mozilla'
    }
  });

  const email = response.data.email_addr;
  const sid = response.data.sid_token;

  return {
    email,
    sid,
    
    async checkEmail() {
      const res = await axios.get(baseURL, {
        params: {
          f: 'check_email',
          sid_token: sid,
          seq: 0
        }
      });
      
      return res.data.list || [];
    },

    async getEmail(emailId) {
      const res = await axios.get(baseURL, {
        params: {
          f: 'fetch_email',
          sid_token: sid,
          email_id: emailId
        }
      });
      
      return res.data;
    }
  };
}
