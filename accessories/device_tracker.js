'use strict';

var Service;
var Characteristic;
var communicationError;

class FireflyDeviceTracker {
  constructor(log, data, client, service, characteristic, onValue, offValue) {
        // device info
    this.data = data;
    this.entity_id = data.ff_id;
    this.uuid_base = data.ff_id;
    this.name = data.alias;

    this.entity_type = data.entity_id.split('.')[0];

    this.client = client;
    this.log = log;

    this.service = service;
    this.characteristic = characteristic;
    this.onValue = onValue;
    this.offValue = offValue;
  }

  onEvent(oldState, newState) {
    this.sensorService.getCharacteristic(this.characteristic)
          .setValue(newState.state === 'home' ? this.onValue : this.offValue, null, 'internal');
  }
  identify(callback) {
    this.log('identifying: ' + this.name);
    callback();
  }
  getState(callback) {
    this.log('fetching state for: ' + this.name);
    this.client.fetchState(this.entity_id, function (data) {
      if (data) {
        callback(null, data.state === 'home' ? this.onValue : this.offValue);
      } else {
        callback(communicationError);
      }
    }.bind(this));
  }
  getServices() {
    this.sensorService = new this.service();
    this.sensorService
          .getCharacteristic(this.characteristic)
          .on('get', this.getState.bind(this));

    var informationService = new Service.AccessoryInformation();

    informationService
          .setCharacteristic(Characteristic.Manufacturer, 'Firefly')
          .setCharacteristic(Characteristic.Model, ' Device Tracker')
          .setCharacteristic(Characteristic.SerialNumber, this.entity_id);

    return [informationService, this.sensorService];
  }
}

function FireflyDeviceTrackerFactory(log, data, client) {
  if (!(data.attributes)) {
    return null;
  }
  return new FireflyDeviceTracker(log, data, client,
      Service.OccupancySensor,
      Characteristic.OccupancyDetected,
      Characteristic.OccupancyDetected.OCCUPANCY_DETECTED,
      Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
}

function FireflyDeviceTrackerFactoryPlatform(oService, oCharacteristic, oCommunicationError) {
  Service = oService;
  Characteristic = oCharacteristic;
  communicationError = oCommunicationError;

  return FireflyDeviceTrackerFactory;
}

module.exports = FireflyDeviceTrackerFactoryPlatform;
module.exports.FireflyDeviceTrackerFactory = FireflyDeviceTrackerFactory;
