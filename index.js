'use strict';

let Service;
let Characteristic;
const url = require('url');
const request = require('request');
const EventSource = require('eventsource');

const communicationError = new Error('Can not communicate with Home Assistant.');

let FireflyBinarySensorFactory;
let FireflyCoverFactory;
let FireflyFan;
let FireflyLight;
let FireflyLock;
let FireflyMediaPlayer;
let FireflySensorFactory;
let FireflySwitch;
let FireflyDeviceTrackerFactory;

function FireflyPlatform(log, config, api) {
  // auth info
  this.host = config.host;
  this.password = config.password;
  this.supportedTypes = config.supported_types || ['binary_sensor', 'cover', 'device_tracker', 'fan', 'input_boolean', 'light', 'lock', 'media_player', 'scene', 'sensor', 'switch']; //TODO: Rename these to match Firefly
  this.foundAccessories = [];
  this.logging = config.logging !== undefined ? config.logging : true;

  this.log = log;

  if (api) {
    // Save the API object as plugin needs to register new accessory via this object.
    this.api = api;
  }

  const es = new EventSource(`${config.host}/api/stream?api_password=${encodeURIComponent(this.password)}`);
  es.addEventListener('message', (e) => {
    if (this.logging) {
      this.log(`Received event: ${e.data}`);
    }
    if (e.data === 'ping') {
      return;
    }

    const data = JSON.parse(e.data);
    if (data.event_type !== 'state_changed') {
      return;
    }

    const numAccessories = this.foundAccessories.length;
    for (let i = 0; i < numAccessories; i++) {
      const accessory = this.foundAccessories[i];

      if (accessory.entity_id === data.data.entity_id && accessory.onEvent) {
        accessory.onEvent(data.data.old_state, data.data.new_state);
      }
    }
  });
}

FireflyPlatform.prototype = {
  // TODO: Update this function.
  request(method, path, options, callback) {
    const requestURL = `${this.host}/api${path}`;
    /* eslint-disable no-param-reassign */
    options = options || {};
    options.query = options.query || {};
    /* eslint-enable no-param-reassign */

    const reqOpts = {
      url: url.parse(requestURL),
      method: method || 'GET',
      qs: options.query,
      body: JSON.stringify(options.body),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-ha-access': this.password,
      },
    };

    request(reqOpts, (error, response, body) => {
      if (error) {
        callback(error, response);
        return;
      }

      if (response.statusCode === 401) {
        callback(new Error('You are not authenticated'), response);
        return;
      }

      callback(error, response, JSON.parse(body));
    });
  },
  // TODO: Update this function.
  fetchState(entityID, callback) {
    this.request('GET', `/states/${entityID}`, {}, (error, response, data) => {
      if (error) {
        callback(null);
      } else {
        callback(data);
      }
    });
  },
  // TODO: Update this function.
  callService(domain, service, serviceData, callback) {
    const options = {};
    options.body = serviceData;

    this.request('POST', `/services/${domain}/${service}`, options, (error, response, data) => {
      if (error) {
        callback(null);
      } else {
        callback(data);
      }
    });
  },
  accessories(callback) {
    this.log('Fetching Firefly devices.');

    const that = this;

    this.request('GET', '/states', {}, (error, response, data) => {
      if (error) {
        that.log(`Failed getting devices: ${error}. Retrying...`);
        setTimeout(() => { that.accessories(callback); }, 5000);
        return;
      }

      for (let i = 0; i < data.length; i++) {
        const entity = data[i];
        // TODO: add common_type into Firefly. This should be light, sensor etc.
        const entityType = entity.common_type;

        /* eslint-disable no-continue */
        // ignore devices that are not in the list of supported types
        if (that.supportedTypes.indexOf(entityType) === -1) {
          continue;
        }

        // ignore hidden devices
        if (!entity.export_ui) {
          continue;
        }

        // TODO: add homebridge_hidden to Firefly.
        // ignore homebridge hidden devices
        if (entity.homebridge_hidden) {
          continue;
        }
        /* eslint-enable no-continue */

        // TODO: add homebridge_name to Firefly.
        // support providing custom names
        if (entity.homebridge_name) {
          entity.alias = homebridge_name;
        }

        let accessory = null;

        if (entityType === 'light') {
          accessory = new FireflyLight(that.log, entity, that);
        } else if (entityType === 'switch') {
          accessory = new FireflySwitch(that.log, entity, that);
        } else if (entityType === 'lock') {
          accessory = new FireflyLock(that.log, entity, that);
        } else if (entityType === 'scene') {
          accessory = new FireflySwitch(that.log, entity, that, 'scene');
        } else if (entityType === 'input_boolean') {
          accessory = new FireflySwitch(that.log, entity, that, 'input_boolean');
        } else if (entityType === 'fan') {
          accessory = new FireflyFan(that.log, entity, that);
        } else if (entityType === 'cover') {
          accessory = FireflyCoverFactory(that.log, entity, that);
        } else if (entityType === 'sensor') {
          accessory = FireflySensorFactory(that.log, entity, that);
        } else if (entityType === 'device_tracker') {
          accessory = FireflyDeviceTrackerFactory(that.log, entity, that);
        } else if (entityType === 'media_player' && entity.attributes && entity.attributes.supported_features) {
          accessory = new FireflyMediaPlayer(that.log, entity, that);
        } else if (entityType === 'binary_sensor' && entity.attributes && entity.attributes.sensor_class) {
          accessory = FireflyBinarySensorFactory(that.log, entity, that);
        }

        if (accessory) {
          that.foundAccessories.push(accessory);
        }
      }

      callback(that.foundAccessories);
    });
  },
};

function HomebridgeFirefly(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  /* eslint-disable global-require */
  FireflyLight = require('./accessories/light')(Service, Characteristic, communicationError);
  FireflySwitch = require('./accessories/switch')(Service, Characteristic, communicationError);
  FireflyLock = require('./accessories/lock')(Service, Characteristic, communicationError);
  FireflyMediaPlayer = require('./accessories/media_player')(Service, Characteristic, communicationError);
  FireflyFan = require('./accessories/fan')(Service, Characteristic, communicationError);
  FireflyCoverFactory = require('./accessories/cover')(Service, Characteristic, communicationError);
  FireflySensorFactory = require('./accessories/sensor')(Service, Characteristic, communicationError);
  FireflyBinarySensorFactory = require('./accessories/binary_sensor')(Service, Characteristic, communicationError);
  FireflyDeviceTrackerFactory = require('./accessories/device_tracker')(Service, Characteristic, communicationError);
  /* eslint-enable global-require */

  homebridge.registerPlatform('homebridge-homeassistant', 'Firefly', FireflyPlatform, false);
}

module.exports = HomebridgeFirefly;

module.exports.platform = FireflyPlatform;
