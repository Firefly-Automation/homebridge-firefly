'use strict';

let Service;
let Characteristic;
let communicationError;

function toTitleCase(str) {
  return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

class FireflyBinarySensor {
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
        .setValue(newState.state === 'on' ? this.onValue : this.offValue, null, 'internal');
  }
  identify(callback) {
    this.log(`identifying: ${this.name}`);
    callback();
  }
  getState(callback) {
    this.log(`fetching state for: ${this.name}`);
    this.client.fetchState(this.entity_id, (data) => {
      if (data) {
        callback(null, data.state === 'on' ? this.onValue : this.offValue);
      } else {
        callback(communicationError);
      }
    });
  }
  getServices() {
    this.sensorService = new this.service(); // eslint-disable-line new-cap
    this.sensorService
        .getCharacteristic(this.characteristic)
        .on('get', this.getState.bind(this));

    const informationService = new Service.AccessoryInformation();

    informationService
          .setCharacteristic(Characteristic.Manufacturer, 'Firefly')
          .setCharacteristic(Characteristic.Model, `${toTitleCase(this.data.attributes.sensor_class)} Binary Sensor`)
          .setCharacteristic(Characteristic.SerialNumber, this.entity_id);

    return [informationService, this.sensorService];
  }
}

function FireflyBinarySensorFactory(log, data, client) {
  if (!(data.attributes && data.attributes.sensor_class)) {
    return null;
  }

  //TODO: Figure out how I want to map out the sensor class. Would this be the device_type? So device_type=MOTION, common_type=sensor.
  switch (data.attributes.sensor_class) {
    case 'moisture':
      return new FireflyBinarySensor(log, data, client,
                                           Service.LeakSensor,
                                           Characteristic.LeakDetected,
                                           Characteristic.LeakDetected.LEAK_DETECTED,
                                           Characteristic.LeakDetected.LEAK_NOT_DETECTED);
    case 'motion':
      return new FireflyBinarySensor(log, data, client,
                                           Service.MotionSensor,
                                           Characteristic.MotionDetected,
                                           true,
                                           false);
    case 'occupancy':
      return new FireflyBinarySensor(log, data, client,
                                           Service.OccupancySensor,
                                           Characteristic.OccupancyDetected,
                                           Characteristic.OccupancyDetected.OCCUPANCY_DETECTED,
                                           Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
    case 'opening':
      return new FireflyBinarySensor(log, data, client,
                                           Service.ContactSensor,
                                           Characteristic.ContactSensorState,
                                           Characteristic.ContactSensorState.CONTACT_NOT_DETECTED,
                                           Characteristic.ContactSensorState.CONTACT_DETECTED);
    case 'smoke':
      return new FireflyBinarySensor(log, data, client,
                                           Service.SmokeSensor,
                                           Characteristic.SmokeDetected,
                                           Characteristic.SmokeDetected.SMOKE_DETECTED,
                                           Characteristic.SmokeDetected.SMOKE_NOT_DETECTED);
    default:
      log.error(`'${data.entity_id}' has a sensor_class of '${data.attributes.sensor_class}' which is not supported by ` +
                'homebridge-homeassistant. Supported classes are \'moisture\', \'motion\', \'occupancy\', \'opening\' and \'smoke\'. ' +
                'See the README.md for more information.');
      return null;
  }
}

function FireflyBinarySensorPlatform(oService, oCharacteristic, oCommunicationError) {
  Service = oService;
  Characteristic = oCharacteristic;
  communicationError = oCommunicationError;

  return FireflyBinarySensorFactory;
}

module.exports = FireflyBinarySensorPlatform;
module.exports.FireflyBinarySensorFactory = FireflyBinarySensorFactory;
