import Homey from 'homey';
import { json } from 'stream/consumers';

const { OAuth2Driver } = require('homey-oauth2app');
const path = require('path');
const GoogleAssistant = require('./../../googleassistant');
const {google} = require('googleapis');

const fs = require('fs');

const SAVED_TOKENS_PATH = path.resolve(__dirname, './../../lib/tokens.json');
const KEY_FILE_PATH = path.resolve(__dirname, './../../lib/devicecredentials.json');

module.exports = class MyBrandDriver extends OAuth2Driver {

  currentAssistant: any = null;
  currentConversation: any = null;

  async onOAuth2Init() {
    // Register Flow Cards etc.

    await super.onOAuth2Init();

  }

  async onPairListDevices({ oAuth2Client }) {
    this.log('onPairListDevices called');
    
    const settings = this.homey.settings;
    const CLIENT_ID = settings.get('clientid');
    const CLIENT_SECRET = settings.get('clientsecret');
    
    this.log('Client ID:', CLIENT_ID ? 'Present' : 'Missing');
    this.log('Client Secret:', CLIENT_SECRET ? 'Present' : 'Missing');
    
    if (!CLIENT_ID || !CLIENT_SECRET) {
      throw new Error('Please configure Client ID and Client Secret in app settings first');
    }
    
    if (!oAuth2Client || !oAuth2Client._token) {
      throw new Error('OAuth2 authentication failed. Please try again.');
    }
    
    this.log('OAuth2 token received:', oAuth2Client._token ? 'Present' : 'Missing');
    this.log('Token keys:', Object.keys(oAuth2Client._token).join(', '));
    
    // Save tokens for the Google Assistant SDK in Google format
    const {mkdirp} = require('mkdirp');
    const REDIRECT_URI = 'https://callback.athom.com/oauth2/callback';
    
    // Convert Homey OAuth2 token to Google format
    const googleToken = {
      access_token: oAuth2Client._token.access_token,
      refresh_token: oAuth2Client._token.refresh_token,
      scope: oAuth2Client._token.scope,
      token_type: oAuth2Client._token.token_type || 'Bearer',
      expiry_date: oAuth2Client._token.expires_in 
        ? Date.now() + (oAuth2Client._token.expires_in * 1000)
        : undefined
    };
    
    try {
      await mkdirp(path.dirname(SAVED_TOKENS_PATH));
      fs.writeFileSync(SAVED_TOKENS_PATH, JSON.stringify(googleToken));
      this.log('Tokens saved successfully in Google format');
    } catch (error) {
      this.error('Error saving tokens:', error);
    }
    
    // Return a single device
    const devices = [{
      data: { 
        id: "google-assistant-driver"
      }, 
      name: "Google Assistant"
    }];
    
    this.log('Returning', devices.length, 'device(s)');
    return devices;
  }

  async sendQuery(oAuth2Client, query, is_new) {

    return new Promise((resolve, reject) => {
      const config = {
        auth: {
          keyFilePath: KEY_FILE_PATH,
          savedTokensPath: SAVED_TOKENS_PATH,
          oauth2Client: oAuth2Client
        },
        conversation: {
          textQuery: query,
          isNew: is_new,
          screen: {
            isOn: true,
          },
        },
      };

      this.log(config.auth);

      const assistant = new GoogleAssistant(config.auth);
      this.currentAssistant = assistant;
      
      this.log("assistant ready");

      let responseText = '';
      let deviceAction = null;
      let screenData = null;

      // starts a new conversation with the assistant
      const startConversation = (conversation) => {
        this.currentConversation = conversation;
        
        conversation
          .on('audio-data', (data) => {
            this.log('Event: audio-data');
            // do stuff with the audio data from the server
          })
          .on('data', (data) => {
            this.log('Event: data - Received!');
            try {
              if (data) {
                this.log('Event: data - Has data, Keys:', Object.keys(data).join(', '));
                if (data.speechResults) {
                  this.log('Has speechResults:', JSON.stringify(data.speechResults, null, 2));
                }
                if (data.debugInfo) this.log('Has debugInfo');
                if (data.eventType) this.log('Has eventType:', data.eventType);
                if (data.audioOut) this.log('Has audioOut');
                if (data.dialogStateOut) {
                  this.log('Has dialogStateOut:', JSON.stringify(data.dialogStateOut, null, 2));
                }
                if (data.screenOut) this.log('Has screenOut');
                if (data.deviceAction) this.log('Has deviceAction');
              } else {
                this.log('Event: data - data is null/undefined');
              }
            } catch (err) {
              this.log('Error processing data event:', err);
            }
          })
          .on('end-of-utterance', () => {
            this.log('Event: end-of-utterance');
            // do stuff when done speaking to the assistant
          })
          .on('transcription', (data) => {
            this.log('Event: transcription', data);
            // do stuff with the words you are saying to the assistant
          })
          .on('response', (text) => {
            this.log('Event: response');
            this.log('Response from Google Assistant:', text);
            if (text) {
              responseText = text;
            }
          })
          .on('volume-percent', (percent) => {
            this.log('Event: volume-percent', percent);
            // do stuff with a volume percent change (range from 1-100)
          })
          .on('device-action', (action) => {
            this.log('Event: device-action');
            // Google Assistant wants to control a device
            this.log('Device action received:', JSON.stringify(action));
            
            // Only save if it contains actual commands (not just requestId)
            if (action && (action.commands || action.execution || action.inputs)) {
              this.log('Valid device action with commands detected');
              deviceAction = action;
            } else {
              this.log('Device action only contains requestId, no actual commands');
            }
          })
          .on('screen-data', (screen) => {
            this.log('Event: screen-data');
            // Screen data often contains the HTML response with the actual answer
            this.log('Screen data received - format:', screen.format);
            this.log('Screen data has data?:', !!screen.data);
            this.log('Screen data keys:', Object.keys(screen));
            screenData = screen;
            
            // Try to extract text from HTML screen data
            if (screen.format === 'HTML' && screen.data) {
              try {
                const htmlString = Buffer.from(screen.data).toString('utf8');
                this.log('HTML response length:', htmlString.length);
                this.log('HTML response:', htmlString.substring(0, 500)); // Log first 500 chars
                
                // Simple HTML tag removal to extract text
                const textOnly = htmlString
                  .replace(/<style[^>]*>.*?<\/style>/gis, '')
                  .replace(/<script[^>]*>.*?<\/script>/gis, '')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                
                this.log('Extracted text length:', textOnly.length);
                if (textOnly && !responseText) {
                  responseText = textOnly;
                  this.log('Extracted text from HTML:', textOnly);
                }
              } catch (error) {
                this.log('Error parsing screen data:', error);
              }
            } else {
              this.log('Screen data not HTML or no data - format:', screen.format, 'data:', !!screen.data);
            }
            
            // Check if screen data contains device actions
            if (screen.data) {
              try {
                const dataString = Buffer.from(screen.data).toString('utf8');
                // Look for action.devices patterns in the HTML/JSON
                if (dataString.includes('action.devices') || dataString.includes('"commands"')) {
                  this.log('Screen data might contain device actions');
                }
              } catch (error) {
                // Ignore parsing errors
              }
            }
          })
          .on('ended', (error, continueConversation) => {
            this.log('Event: ended', 'error:', !!error, 'continueConversation:', continueConversation);
            if (error) {
              this.log('Conversation Ended Error:', error);
              this.currentAssistant = null;
              this.currentConversation = null;
              reject(error);
            } else if (continueConversation) {
              // Google Assistant wants to continue the conversation (e.g., follow-up question)
              this.log('Google Assistant wants to continue the conversation');
              // Don't resolve yet, let the conversation continue
            } else {
              // Conversation complete, stop automatically
              this.log('Conversation Complete');
              this.log('Final response:', responseText);
              this.log('Device action:', deviceAction ? JSON.stringify(deviceAction) : 'None');
              this.currentAssistant = null;
              this.currentConversation = null;
              resolve({
                response: responseText || 'No response received',
                deviceAction: deviceAction ? JSON.stringify(deviceAction) : ''
              });
            }
          })
          .on('data', (data) => {
            this.log('Event: data');
            // raw data from the google assistant conversation
          })
          .on('error', (error) => {
            this.log('Event: error', error);
            this.log(error);
            this.currentAssistant = null;
            this.currentConversation = null;
            reject(error);
          })
      };

      // will start a conversation and wait for audio data
      assistant
        .on('ready', () => assistant.start(config.conversation))
        .on('started', startConversation)
        .on('error', (error) => {
          this.log('Assistant error:', error);
          this.currentAssistant = null;
          this.currentConversation = null;
          reject(error);
        });
    });
  }

  stopConversation() {
    this.log('Stopping conversation...');
    
    if (this.currentConversation) {
      try {
        this.currentConversation.end();
        this.log('Conversation ended');
      } catch (error) {
        this.log('Error ending conversation:', error);
      }
    }
    
    this.currentAssistant = null;
    this.currentConversation = null;
    
    return true;
  }

  async discoverCastDevices() {
    this.log('Discovering Cast devices...');
    
    return new Promise((resolve, reject) => {
      const mdns = require('mdns-js');
      const devices: any[] = [];
      const timeout = 3000; // 3 seconds discovery timeout
      
      try {
        const browser = mdns.createBrowser(mdns.tcp('googlecast'));
        
        browser.on('ready', () => {
          this.log('mDNS browser ready, discovering...');
          browser.discover();
        });
        
        browser.on('update', (data: any) => {
          this.log('Found Cast device:', data.fullname);
          
          // Extract device info
          const deviceName = data.fullname?.split('.')[0] || 'Unknown Device';
          const deviceType = data.txt?.find((t: string) => t.startsWith('md='))?.split('=')[1] || 'Cast Device';
          
          // Avoid duplicates
          if (!devices.find(d => d.name === deviceName)) {
            devices.push({
              name: deviceName,
              type: deviceType,
              host: data.host,
              port: data.port
            });
          }
        });
        
        // Stop discovery after timeout
        setTimeout(() => {
          browser.stop();
          this.log(`Discovery complete, found ${devices.length} devices`);
          resolve(devices);
        }, timeout);
        
      } catch (error) {
        this.error('Error discovering cast devices:', error);
        reject(error);
      }
    });
  }

}
