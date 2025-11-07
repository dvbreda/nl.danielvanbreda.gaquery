import Homey from 'homey';

const { OAuth2Device } = require('homey-oauth2app');
const {google} = require('googleapis');

module.exports = class MyBrandDevice extends OAuth2Device {

  googleOAuth2Client: any;

  async onOAuth2Init() {
    this.log('onOAuth2Init called');
    
    // Register custom capabilities if they don't exist
    if (!this.hasCapability('last_query')) {
      await this.addCapability('last_query').catch(err => this.error('Error adding last_query capability:', err));
    }
    if (!this.hasCapability('last_response')) {
      await this.addCapability('last_response').catch(err => this.error('Error adding last_response capability:', err));
    }
    if (!this.hasCapability('last_device_action')) {
      await this.addCapability('last_device_action').catch(err => this.error('Error adding last_device_action capability:', err));
    }
    
    // Set initial values
    await this.setCapabilityValue('last_query', '').catch(err => this.error(err));
    await this.setCapabilityValue('last_response', '').catch(err => this.error(err));
    await this.setCapabilityValue('last_device_action', '').catch(err => this.error(err));
    
    await this.initializeGoogleClient();
  }
  
  async initializeGoogleClient() {
    // Always recreate Google OAuth2 Client from tokens
    const appSettings = this.homey.settings;
    const CLIENT_ID = appSettings.get('clientid');
    const CLIENT_SECRET = appSettings.get('clientsecret');
    const REDIRECT_URI = 'https://callback.athom.com/oauth2/callback';
    
    this.log('Initializing Google OAuth2 Client...');
    this.log('Client ID:', CLIENT_ID ? 'Present' : 'Missing');
    this.log('Client Secret:', CLIENT_SECRET ? 'Present' : 'Missing');
    
    if (!CLIENT_ID || !CLIENT_SECRET) {
      this.error('Client ID or Secret missing in app settings');
      return;
    }
    
    this.googleOAuth2Client = new google.auth.OAuth2(
      CLIENT_ID, CLIENT_SECRET, REDIRECT_URI
    );
    
    // Set credentials from the OAuth2 token
    if (this.oAuth2Client && this.oAuth2Client._token) {
      this.log('Setting credentials from OAuth2 token');
      this.log('Token structure:', Object.keys(this.oAuth2Client._token).join(', '));
      
      // Convert Homey OAuth2 token to Google format
      const googleToken = {
        access_token: this.oAuth2Client._token.access_token,
        refresh_token: this.oAuth2Client._token.refresh_token,
        scope: this.oAuth2Client._token.scope,
        token_type: this.oAuth2Client._token.token_type || 'Bearer',
        expiry_date: this.oAuth2Client._token.expires_in 
          ? Date.now() + (this.oAuth2Client._token.expires_in * 1000)
          : undefined
      };
      
      this.log('Converted token for Google:', JSON.stringify(googleToken));
      this.googleOAuth2Client.setCredentials(googleToken);
      this.log('Google OAuth2 Client initialized successfully');
    } else {
      this.error('No OAuth2 token available');
    }
  }

  async onOAuth2Deleted() {
    // Clean up here
  }

  /**
   * Update device capabilities with the latest query results
   */
  async updateQueryResults(query: string, response: string, deviceAction: string) {
    try {
      await this.setCapabilityValue('last_query', query);
      await this.setCapabilityValue('last_response', response);
      await this.setCapabilityValue('last_device_action', deviceAction);
      this.log('Updated query results on device capabilities');
    } catch (err) {
      this.error('Error updating query results:', err);
    }
  }

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('MyDevice has been initialized');
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('MyDevice has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    this.log("MyDevice settings where changed");
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('MyDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('MyDevice has been deleted');
  }

}

