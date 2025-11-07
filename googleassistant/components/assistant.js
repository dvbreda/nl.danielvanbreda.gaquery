'use strict';

const EventEmitter = require('events');
const util = require('util');
const grpc = require('@grpc/grpc-js');

const EmbeddedAssistantClient = require('./embedded-assistant').EmbeddedAssistantClient;

const ASSISTANT_API_ENDPOINT = 'embeddedassistant.googleapis.com';

function Assistant(client) {
  const sslCreds = grpc.credentials.createSsl();
    // Newer versions of google-auth-library's OAuth2Client no longer expose
    // `getRequestMetadata` (which grpc's createFromGoogleCredential expected).
    // Create call credentials from a metadata generator that works with both
    // older and newer clients:
    const metadataGenerator = (params, callback) => {
      // If the client supports the older getRequestMetadata(callback) API
      if (typeof client.getRequestMetadata === 'function') {
        client.getRequestMetadata((err, md) => {
          if (err) return callback(err);
          const metadata = new grpc.Metadata();
          // md may already be a Metadata object or a plain object of headers
          if (md instanceof grpc.Metadata) {
            return callback(null, md);
          }
          Object.keys(md || {}).forEach(k => metadata.add(k, md[k]));
          callback(null, metadata);
        });
        return;
      }

      // Newer google-auth-library versions provide getRequestHeaders() which
      // returns a Promise that resolves to a headers object.
      if (typeof client.getRequestHeaders === 'function') {
        Promise.resolve()
          .then(() => client.getRequestHeaders())
          .then(headers => {
            const metadata = new grpc.Metadata();
            Object.keys(headers || {}).forEach(k => metadata.add(k, headers[k]));
            callback(null, metadata);
          })
          .catch(err => callback(err));
        return;
      }

      // Fallback: try to use getAccessToken and construct an Authorization header
      if (typeof client.getAccessToken === 'function') {
        Promise.resolve()
          .then(() => client.getAccessToken())
          .then(tokenResp => {
            const token = tokenResp && (tokenResp.token || tokenResp.access_token || tokenResp);
            const metadata = new grpc.Metadata();
            if (token) metadata.add('authorization', `Bearer ${token}`);
            callback(null, metadata);
          })
          .catch(err => callback(err));
        return;
      }

      callback(new Error('Auth client does not support metadata generation'));
    };

    const callCreds = grpc.credentials.createFromMetadataGenerator(metadataGenerator);
    const combinedCreds = grpc.credentials.combineChannelCredentials(sslCreds, callCreds);

  return (new EmbeddedAssistantClient(ASSISTANT_API_ENDPOINT, combinedCreds));
};

util.inherits(Assistant, EventEmitter);
module.exports = Assistant;