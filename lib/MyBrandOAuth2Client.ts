const { OAuth2Client, OAuth2Error } = require('homey-oauth2app');
//const MyBrandOAuth2Token = require('./MyBrandOAuth2Token');

module.exports = class MyBrandOAuth2Client extends OAuth2Client {

  // Required:
  static API_URL = 'https://accounts.google.com/o/oauth2/auth?response_type=code&';
  static TOKEN_URL = 'https://oauth2.googleapis.com/token';
  static AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/auth';
  static SCOPES = [ 'https://www.googleapis.com/auth/userinfo.profile','https://www.googleapis.com/auth/userinfo.email' ];

  // Optional:
  //static TOKEN = MyBrandOAuth2Token; // Default: OAuth2Token
  static REDIRECT_URL = 'https://callback.athom.com/oauth2/callback'; // Default: 'https://callback.athom.com/oauth2/callback'

  // Overload what needs to be overloaded here

  async onHandleNotOK({ body }) {
      throw new OAuth2Error(body.error);
  }

  async getThings({ code }) {
    return this.get({
      path: '',
      query: { code },
    });
  }
  async getRequestHeaders() {
    return "hallo";
  }

  async updateThing({ id, code }) {
    return this.put({
      path: `${id}`,
      json: { code },
    });
  }

}