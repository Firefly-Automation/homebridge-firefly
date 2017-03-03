'use strict';

let Service;
let Characteristic;
let communicationError;

function FireflyLock(log, data, client) {
  // device info
  this.domain = 'lock';
  this.data = data;
  this.entity_id = data.ff_id;
  this.uuid_base = data.ff_id;
  this.name = data.alias;

  this.client = client;
  this.log = log;
}

FireflyLock.prototype = {
  onEvent(oldState, newState) {
    const lockState = newState.state === 'unlocked' ? 0 : 1;
    this.lockService.getCharacteristic(Characteristic.LockCurrentState)
        .setValue(lockState, null, 'internal');
    this.lockService.getCharacteristic(Characteristic.LockTargetState)
        .setValue(lockState, null, 'internal');
  },
  getLockState(callback) {
    this.client.fetchState(this.entity_id, (data) => {
      if (data) {
        const lockState = data.state === 'locked';
        callback(null, lockState);
      } else {
        callback(communicationError);
      }
    });
  },
  setLockState(lockOn, callback, context) {
    if (context === 'internal') {
      callback();
      return;
    }

    const that = this;
    const serviceData = {};
    serviceData.entity_id = this.entity_id;

    if (lockOn) {
      this.log(`Setting lock state on the '${this.name}' to locked`);

      this.client.callService(this.domain, 'lock', serviceData, (data) => {
        if (data) {
          that.log(`Successfully set lock state on the '${that.name}' to locked`);
          callback();
        } else {
          callback(communicationError);
        }
      });
    } else {
      this.log(`Setting lock state on the '${this.name}' to unlocked`);

      this.client.callService(this.domain, 'unlock', serviceData, (data) => {
        if (data) {
          that.log(`Successfully set lock state on the '${that.name}' to unlocked`);
          callback();
        } else {
          callback(communicationError);
        }
      });
    }
  },
  getServices() {
    this.lockService = new Service.LockMechanism();
    const informationService = new Service.AccessoryInformation();

    informationService
          .setCharacteristic(Characteristic.Manufacturer, 'Firefly')
          .setCharacteristic(Characteristic.Model, 'Lock')
          .setCharacteristic(Characteristic.SerialNumber, this.entity_id);

    this.lockService
        .getCharacteristic(Characteristic.LockCurrentState)
        .on('get', this.getLockState.bind(this));

    this.lockService
        .getCharacteristic(Characteristic.LockTargetState)
        .on('get', this.getLockState.bind(this))
        .on('set', this.setLockState.bind(this));

    return [informationService, this.lockService];
  },

};

function FireflyLockPlatform(oService, oCharacteristic, oCommunicationError) {
  Service = oService;
  Characteristic = oCharacteristic;
  communicationError = oCommunicationError;

  return FireflyLock;
}

module.exports = FireflyLockPlatform;
module.exports.FireflyLock = FireflyLock;
