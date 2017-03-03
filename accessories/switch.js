'use strict';

let Service;
let Characteristic;
let communicationError;

function FireflySwitch(log, data, client, type) {
  // device info
  this.domain = type || 'switch';
  this.data = data;
  this.entity_id = data.ff_id;
  this.uuid_base = data.ff_id;
  this.name = data.alias;
  this.client = client;
  this.log = log;
}

FireflySwitch.prototype = {
  onEvent(oldState, newState) {
    this.switchService.getCharacteristic(Characteristic.On)
        .setValue(newState.state === 'on', null, 'internal');
  },
  getPowerState(callback) {
    this.client.fetchState(this.entity_id, (data) => {
      if (data) {
        const powerState = data.request_values.STATE === true;
        callback(null, powerState);
      } else {
        callback(communicationError);
      }
    });
  },
  setPowerState(powerOn, callback, context) {
    if (context === 'internal') {
      callback();
      return;
    }

    const that = this;
    const serviceData = {};
    serviceData.entity_id = this.entity_id;

    if (powerOn) {
      this.log(`Setting power state on the '${this.name}' to on`);

      //TODO: Update this section. These updates will depend on updates to callService in index.js
      this.client.callService(this.domain, 'turn_on', serviceData, (data) => {
        if (this.domain === 'scene') {
          this.switchService.getCharacteristic(Characteristic.On)
              .setValue('off', null, 'internal');
        }
        if (data) {
          that.log(`Successfully set power state on the '${that.name}' to on`);
          callback();
        } else {
          callback(communicationError);
        }
      });
    } else {
      this.log(`Setting power state on the '${this.name}' to off`);

      this.client.callService(this.domain, 'turn_off', serviceData, (data) => {
        if (data) {
          that.log(`Successfully set power state on the '${that.name}' to off`);
          callback();
        } else {
          callback(communicationError);
        }
      });
    }
  },
  getServices() {
    this.switchService = new Service.Switch();
    const informationService = new Service.AccessoryInformation();
    let model;

    switch (this.domain) {
      case 'scene':
        model = 'Scene';
        break;
      case 'input_boolean':
        model = 'Input boolean';
        break;
      default:
        model = 'Switch';
    }

    informationService
          .setCharacteristic(Characteristic.Manufacturer, 'Firefly')
          .setCharacteristic(Characteristic.Model, model)
          .setCharacteristic(Characteristic.SerialNumber, this.entity_id);

    if (this.domain === 'switch') {
      this.switchService
          .getCharacteristic(Characteristic.On)
          .on('get', this.getPowerState.bind(this))
          .on('set', this.setPowerState.bind(this));
    } else {
      this.switchService
          .getCharacteristic(Characteristic.On)
          .on('set', this.setPowerState.bind(this));
    }

    return [informationService, this.switchService];
  },

};

function FireflySwitchPlatform(oService, oCharacteristic, oCommunicationError) {
  Service = oService;
  Characteristic = oCharacteristic;
  communicationError = oCommunicationError;

  return FireflySwitch;
}

module.exports = FireflySwitchPlatform;
module.exports.FireflySwitch = FireflySwitch;
