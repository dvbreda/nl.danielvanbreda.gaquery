'use strict';

import Homey from 'homey';

const { OAuth2App } = require('homey-oauth2app');
const MyBrandOAuth2Client = require('./lib/MyBrandOAuth2Client');
const path = require('path');
//const GoogleAssistant = require('./googleassistant');


var CLIENT_ID = "";
var CLIENT_SECRET = "";

module.exports = class MyBrandApp extends OAuth2App {

  static OAUTH2_CLIENT = MyBrandOAuth2Client; // Default: OAuth2Client
  static OAUTH2_DEBUG = true; // Default: false
  static OAUTH2_MULTI_SESSION = false; // Default: false
  static OAUTH2_DRIVERS = [ 'google-assistant-driver' ]; // Default: all drivers

  async onOAuth2Init() {
    // Do App logic here
    
    const settings = this.homey.settings;
		CLIENT_ID = settings.get('clientid');
		CLIENT_SECRET = settings.get('clientsecret');
		
		this.log('=== App Settings ===');
		this.log('CLIENT_ID:', CLIENT_ID || '(empty)');
		this.log('CLIENT_SECRET:', CLIENT_SECRET ? '(present)' : '(empty)');
		
		if (CLIENT_ID == "" || CLIENT_SECRET == "" || !CLIENT_ID || !CLIENT_SECRET) {
			this.log("Warning: Please enter your CLIENT ID and SECRET in settings");
			// Don't return - continue to register flow cards
		} 

    this.log("Google Assistant Query is running");
    
    // Register flow cards
    this.registerFlowCards();
  }
  
  async registerFlowCards() {
    const queryAction = this.homey.flow.getActionCard('query');
    const stopAction = this.homey.flow.getActionCard('stop');
    
    queryAction.registerRunListener(async (args, state) => {
      this.log('Flow card triggered with query:', args.query, 'new:', args.new);
      
      // Get the driver
      const driver = this.homey.drivers.getDriver('google-assistant-driver');
      if (!driver) {
        throw new Error('Google Assistant driver not found');
      }
      
      // Get the first device (there should only be one)
      const devices = driver.getDevices();
      if (devices.length === 0) {
        throw new Error('No Google Assistant device found. Please pair a device first.');
      }
      
      const device = devices[0];
      
      // Log device state
      this.log('Device found:', device.getName());
      this.log('Google OAuth2 Client:', device.googleOAuth2Client ? 'Present' : 'Missing');
      
      // Get the Google OAuth2 Client from the device
      if (!device.googleOAuth2Client) {
        this.log('Google OAuth2 Client not initialized, attempting to initialize...');
        
        // Try to initialize it now
        if (typeof device.initializeGoogleClient === 'function') {
          await device.initializeGoogleClient();
        }
        
        // Check again
        if (!device.googleOAuth2Client) {
          this.error('Google OAuth2 Client still not initialized after retry');
          throw new Error('Google OAuth2 Client not initialized. Make sure you have entered Client ID and Client Secret in settings, then try re-pairing the device.');
        }
      }
      
      this.log('Sending query to Google Assistant...');
      
      // Call sendQuery on the driver and get the response
      const result = await driver.sendQuery(device.googleOAuth2Client, args.query, args.new);
      
      this.log('Query sent successfully, response:', result.response);
      this.log('Device action:', result.deviceAction || 'None');
      
      // Update device capabilities with the results
      if (typeof device.updateQueryResults === 'function') {
        await device.updateQueryResults(args.query, result.response, result.deviceAction || '');
      }
      
      // Return tokens for use in flow
      return {
        response: result.response,
        device_action: result.deviceAction || ''
      };
    });
    
    stopAction.registerRunListener(async (args, state) => {
      this.log('Stop conversation flow card triggered');
      
      // Get the driver
      const driver = this.homey.drivers.getDriver('google-assistant-driver');
      if (!driver) {
        throw new Error('Google Assistant driver not found');
      }
      
      // Stop the conversation
      driver.stopConversation();
      
      this.log('Conversation stopped');
      
      return true;
    });
    
    this.log('Flow cards "query" and "stop" registered');
  }

  /*async getGaDevice(){
    let driver = this.homey.drivers.getDriver('google-assistant-driver');
    if (driver == undefined){
      throw new Error('No driver found.');
    }

    let device = driver.getDevices().filter(e=>{ return ( e.getData().id == this.getData().id ) })[0];
    if (device == undefined){
      throw new Error('No device found.');
    }
    return device; 
  }

  async goWithTheFlow() {

      let device = await this.getGaDevice();

      this.homey.flow.getActionCard('query')
      .registerRunListener((args, state) => {
          return new Promise((resolve, reject) => {
      
      //https://www.npmjs.com/package/google-assistant
     
      const config = {
        auth: {
          
          oauth2Client: device.settings.oauth
      
        },
        // this param is optional, but all options will be shown
        conversation: {
        
          textQuery: args.query, // if this is set, audio input is ignored
          isNew: args.new, // set this to true if you want to force a new conversation and ignore the old state
          screen: {
            isOn: true, // set this to true if you want to output results to a screen
          },
        },
      };

      this.log(config.auth);

      
      const assistant = new GoogleAssistant(config.auth);
      
      this.log("assistant ready");

      // starts a new conversation with the assistant
      const startConversation = (conversation) => {
        // setup the conversation and send data to it
        // for a full example, see `examples/mic-speaker.js`

        conversation
          .on('audio-data', (data) => {
            // do stuff with the audio data from the server
            // usually send it to some audio output / file
          })
          .on('end-of-utterance', () => {
            // do stuff when done speaking to the assistant
            // usually just stop your audio input
          })
          .on('transcription', (data) => {
            // do stuff with the words you are saying to the assistant
          })
          .on('response', (text) => {
            // do stuff with the text that the assistant said back
          })
          .on('volume-percent', (percent) => {
            // do stuff with a volume percent change (range from 1-100)
          })
          .on('device-action', (action) => {
            // if you've set this device up to handle actions, you'll get that here
          })
          .on('screen-data', (screen) => {
            // if the screen.isOn flag was set to true, you'll get the format and data of the output
          })
          .on('ended', (error, continueConversation) => {
            // once the conversation is ended, see if we need to follow up
            if (error) console.log('Conversation Ended Error:', error);
            else if (continueConversation) assistant.start();
            else console.log('Conversation Complete');
          })
          .on('data', (data) => {
            // raw data from the google assistant conversation
            // useful for debugging or if something is not covered above
          })
          .on('error', (error) => {
          
          this.log(error);
            // handle error messages
          })
      };

      // will start a conversation and wait for audio data
      // as soon as it's ready
      assistant
        .on('ready', () => assistant.start(config.conversation))
        .on('started', startConversation);
      
      
        
      
          });
      })
    
  }*/

}