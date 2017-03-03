'use strict';

let Service;
let Characteristic;
let communicationError;

function FireflyFan(log, data, client) {
  // device info
  this.domain = 'fan';
  this.data = data;
  this.entity_id = data.ff_id;
  this.uuid_base = data.ff_id;
  this.name = data.alias;

  this.client = client;
  this.log = log;
}

FireflyFan.prototype = {
  onEvent(oldState, newState) {
    this.fanService.getCharacteristic(Characteristic.On)
                   .setValue(newState.state === 'on', null, 'internal');
  },
  getPowerState(callback) {
    this.client.fetchState(this.entity_id, (data) => {
      if (data) {
        const powerState = data.state === 'on';
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

      this.client.callService(this.domain, 'turn_on', serviceData, (data) => {
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
  getRotationSpeed(callback) {
    this.client.fetchState(this.entity_id, (data) => {
      if (data) {
        if (data.state === 'off') {
          callback(null, 0);
        } else {
          switch (data.attributes.speed) {
            case 'low':
              callback(null, 25);
              break;
            case 'medium':
              callback(null, 50);
              break;
            case 'high':
              callback(null, 100);
              break;
            default:
              callback(null, 0);
          }
        }
      } else {
        callback(communicationError);
      }
    });
  },
  setRotationSpeed(speed, callback, context) {
    if (context === 'internal') {
      callback();
      return;
    }

    const that = this;
    const serviceData = {};
    serviceData.entity_id = this.entity_id;

    if (speed <= 25) {
      serviceData.speed = 'low';
    } else if (speed <= 75) {
      serviceData.speed = 'med';
    } else if (speed <= 100) {
      serviceData.speed = 'high';
    }

    this.log(`Setting speed on the '${this.name}' to ${serviceData.speed}`);

    this.client.callService(this.domain, 'set_speed', serviceData, (data) => {
      if (data) {
        that.log(`Successfully set power state on the '${that.name}' to on`);
        callback();
      } else {
        callback(communicationError);
      }
    });
  },
  getServices() {
    this.fanService = new Service.Fan();
    const informationService = new Service.AccessoryInformation();

    informationService
          .setCharacteristic(Characteristic.Manufacturer, 'Firefly')
          .setCharacteristic(Characteristic.Model, 'Fan')
          .setCharacteristic(Characteristic.SerialNumber, this.entity_id);

    this.fanService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getPowerState.bind(this))
        .on('set', this.setPowerState.bind(this));

    this.fanService
        .getCharacteristic(Characteristic.RotationSpeed)
        .on('get', this.getRotationSpeed.bind(this))
        .on('set', this.setRotationSpeed.bind(this));

    return [informationService, this.fanService];
  },

};

function FireflyFanPlatform(oService, oCharacteristic, oCommunicationError) {
  Service = oService;
  Characteristic = oCharacteristic;
  communicationError = oCommunicationError;

  return FireflyFan;
}

module.exports = FireflyFanPlatform;
module.exports.FireflyFan = FireflyFan;
