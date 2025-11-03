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

  async onOAuth2Init() {
    // Register Flow Cards etc.

    await super.onOAuth2Init();

  }

  async onPairListDevices({ oAuth2Client }) {

    const settings = this.homey.settings;
    const CLIENT_ID = settings.get('clientid');
		const CLIENT_SECRET = settings.get('clientsecret');
		const TOKEN = settings.get('token');
    const {mkdirp} = require('mkdirp');


    const SCOPES = [ 'https://www.googleapis.com/auth/userinfo.profile','https://www.googleapis.com/auth/userinfo.email' ];
   const REDIRECT_URI = 'https://callback.athom.com/oauth2/callback'; // Default: 'https://callback.athom.com/oauth2/callback'

   
   

    var params = { client_id: encodeURIComponent(CLIENT_ID), /*client_secret : encodeURIComponent(CLIENT_SECRET),*/ redirect_uri : (REDIRECT_URI), scope : SCOPES.join(" ") }

    console.log("https://accounts.google.com/o/oauth2/auth?response_type=code" + "&client_id="+ CLIENT_ID /*"&client_secret="+ CLIENT_SECRET+ */ + "&redirect_uri="+ REDIRECT_URI + "&scope="+ SCOPES.join(" ")  )
    console.log("PARAMS",params);

    console.log("TOKEN:",oAuth2Client._token, oAuth2Client._token.access_token);

    //SAVE TOKENS
    mkdirp(path.dirname(SAVED_TOKENS_PATH))
      .then(() => {
        console.log(JSON.stringify(oAuth2Client._token));
        fs.writeFile(SAVED_TOKENS_PATH, JSON.stringify(oAuth2Client._token), () => {});
      })
      .catch((error) => {
        console.log('Error saving tokens:', error.message);
      });

    //TEST QUERY
    const oAuth2ClientGoogle = new google.auth.OAuth2(
      CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
      oAuth2ClientGoogle.setCredentials(JSON.parse(JSON.stringify(oAuth2Client._token)));

      console.log(oAuth2ClientGoogle);

      this.sendQuery(oAuth2ClientGoogle, "Play Graceland on Spotify", true);

  
    
    

//    let data = await oAuth2Client.getThings(params);


    var devices: object[] = [];
    for (let i=0; i<1; i++){
      var newDevice = { data: { id: "google-assistant-driver"}, name: "Google Assistant Driver", settings: { token: "token", oauth: oAuth2ClientGoogle }}
      devices.push(newDevice);
    }
    return devices;
  

   

  }

  async sendQuery(oAuth2Client, query, is_new) {


    const config = {
      auth: {
        keyFilePath: KEY_FILE_PATH,
        savedTokensPath: SAVED_TOKENS_PATH,
        oauth2Client: oAuth2Client
       
    
      },
      // this param is optional, but all options will be shown
      conversation: {
      
        textQuery: query, // if this is set, audio input is ignored
        isNew: is_new, // set this to true if you want to force a new conversation and ignore the old state
        screen: {
          isOn: true, // set this to true if you want to output results to a screen
        },
      },
    };

    this.log(config.auth);

    //ERROR DUE grpc (deprecated by grpc/grpc-js): googleCredentials.getRequestMetadata is not a function

    
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
          console.log(text);
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
    
    
      
    
     
    
  }

}
