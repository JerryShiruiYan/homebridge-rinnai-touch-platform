import { PlatformAccessory } from 'homebridge';
import { RinnaiTouchPlatform } from '../platform';
import { Modes, ControlModes, ScheduleOverrideModes } from '../rinnai/RinnaiService';
import { ThermostatBase } from './ThermostatBase';

export class HeaterCooler extends ThermostatBase {
  private settingMode = false;

  constructor(
    platform: RinnaiTouchPlatform,
    platformAccessory: PlatformAccessory,
  ) {
    super(platform, platformAccessory);

    const service = this.platformAccessory.getService(this.platform.Service.HeaterCooler);
    if (service) {
      this.service = service;
    } else {
      this.service = this.platformAccessory.addService(this.platform.Service.HeaterCooler, this.serviceName);
      this.initialiseService();
    }

    this.setEventHandlers();
  }

  get serviceName(): string {
    const name: string = this.platformAccessory.context.zone !== 'U'
      ? this.platform.service.getZoneName(this.platformAccessory.context.zone)
      : this.platform.settings.name;
    return name;
  }

  initialiseService(): void {
    this.platform.log.debug(this.constructor.name, 'initialiseService');

    let validStates: number[] = this.getValidCurrentHeaterCoolerStates();
    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .setProps({
        minValue: Math.min(...validStates),
        maxValue: Math.max(...validStates),
        validValues: validStates,
      });

    validStates = this.getValidTargetHeaterCoolerStates();
    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .setProps({
        minValue: Math.min(...validStates),
        maxValue: Math.max(...validStates),
        validValues: validStates,
      });

    this.service
      .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .setProps({
        minValue: 8,
        maxValue: 30,
        minStep: 1,
      });

    this.service
      .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .setProps({
        minValue: 8,
        maxValue: 30,
        minStep: 1,
      });
  }

  getValidCurrentHeaterCoolerStates(): number[] {
    this.platform.log.debug(this.constructor.name, 'getValidCurrentHeaterCoolerStates');

    const validStates = [this.platform.Characteristic.CurrentHeaterCoolerState.IDLE];
    if (this.platform.service.hasHeater) {
      validStates.push(this.platform.Characteristic.CurrentHeaterCoolerState.HEATING);
    }
    if (this.platform.service.hasCooler || this.platform.service.hasEvaporative) {
      validStates.push(this.platform.Characteristic.CurrentHeaterCoolerState.COOLING);
    }
    return validStates;
  }

  getValidTargetHeaterCoolerStates(): number[] {
    this.platform.log.debug(this.constructor.name, 'getValidTargetHeaterCoolerStates');

    const validStates: number[] = [];
    if (this.platform.settings.showAuto && (this.platform.service.hasMultiSetPoint || this.platformAccessory.context.zone === 'U')) {
      validStates.push(this.platform.Characteristic.TargetHeaterCoolerState.AUTO);
    }
    if (this.platform.service.hasHeater) {
      validStates.push(this.platform.Characteristic.TargetHeaterCoolerState.HEAT);
    }
    if (this.platform.service.hasCooler || this.platform.service.hasEvaporative) {
      validStates.push(this.platform.Characteristic.TargetHeaterCoolerState.COOL);
    }

    return validStates;
  }

  setEventHandlers(): void {
    this.platform.log.debug(this.constructor.name, 'setEventHandlers');

    super.setEventHandlers();

    this.service
      .getCharacteristic(this.platform.Characteristic.Active)
      .on('get', this.getCharacteristicValue.bind(this, this.getActive.bind(this), 'Active'))
      .on('set', this.setCharacteristicValue.bind(this, this.setActive.bind(this), 'Active'));

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .on('get', this.getCharacteristicValue.bind(this, this.getCurrentHeaterCoolerState.bind(this), 'CurrentHeaterCoolerState'));

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .on('get', this.getCharacteristicValue.bind(this, this.getTargetHeaterCoolerState.bind(this), 'TargetHeaterCoolerState'))
      .on('set', this.setCharacteristicValue.bind(this, this.setTargetHeaterCoolerState.bind(this), 'TargetHeaterCoolerState'));

    this.service
      .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .on('get', this.getCharacteristicValue.bind(this, this.getThresholdTemperature.bind(this), 'HeatingThresholdTemperature'))
      .on('set', this.setCharacteristicValue.bind(this, this.setThresholdTemperature.bind(this), 'HeatingThresholdTemperature'));

    this.service
      .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .on('get', this.getCharacteristicValue.bind(this, this.getThresholdTemperature.bind(this), 'CoolingThresholdTemperature'))
      .on('set', this.setCharacteristicValue.bind(this, this.setThresholdTemperature.bind(this), 'CoolingThresholdTemperature'));
  }

  getActive(): number {
    this.platform.log.debug(this.constructor.name, 'getActive');

    const state = this.platform.service.hasMultiSetPoint || this.platformAccessory.context.zone === 'U'
      ? this.platform.service.getState()
      : this.platform.service.getUserEnabled(this.platformAccessory.context.zone);

    return state
      ? this.platform.Characteristic.Active.ACTIVE
      : this.platform.Characteristic.Active.INACTIVE;
  }

  getCurrentHeaterCoolerState(): number {
    this.platform.log.debug(this.constructor.name, 'getCurrentHeaterCoolerState');

    const state = this.platformAccessory.context.zone === 'U'
      ? this.platform.service.getSystemActive(this.platformAccessory.context.zone)
      : this.platform.service.getAutoEnabled(this.platformAccessory.context.zone);

    if (!state) {
      return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
    }

    if (this.platform.service.mode === Modes.HEAT) {
      return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
    }

    return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
  }

  getTargetHeaterCoolerState(): number {
    this.platform.log.debug(this.constructor.name, 'getTargetHeaterCoolerState');

    if (this.platform.service.mode === Modes.HEAT) {
      return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
    }

    return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
  }

  getThresholdTemperature(): number {
    this.platform.log.debug(this.constructor.name, 'getThresholdTemperature');

    const zone = this.platform.service.hasMultiSetPoint
      ? this.platformAccessory.context.zone
      : 'U';

    return this.platform.service.getTargetTemperature(zone);
  }

  async setActive(value: number): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setActive', value);

    if (!this.platform.service.hasMultiSetPoint && this.platformAccessory.context.zone !== 'U') {
      if (this.platform.service.getState() || this.platform.service.getFanState()) {
        await this.platform.service.setUserEnabled(
          value === this.platform.Characteristic.Active.ACTIVE,
          this.platformAccessory.context.zone,
        );
        return;
      }
    }

    if (this.platform.service.getFanState() && value === this.platform.Characteristic.Active.INACTIVE) {
      return;
    }

    if (value === this.platform.Characteristic.Active.INACTIVE) {
      await this.platform.service.setState(false);
      return;
    }

    await this.setModeComplete();
    await this.platform.service.setFanState(false);
    await this.platform.service.setState(true);
  }

  async setTargetHeaterCoolerState(value: number): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setTargetHeaterCoolerState', value);

    this.settingMode = true;

    switch (value) {
      case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
        await this.platform.service.setMode(Modes.HEAT);
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
        if (this.platform.service.hasCooler) {
          await this.platform.service.setMode(Modes.COOL);
        } else {
          await this.platform.service.setMode(Modes.EVAP);
        }
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
        if (this.platform.service.getState()) {
          await this.platform.service.setControlMode(ControlModes.SCHEDULE, this.platformAccessory.context.zone);
          await this.platform.service.setScheduleOverride(ScheduleOverrideModes.NONE, this.platformAccessory.context.zone);
        }
        // Force update values so mode switches back to correct mode
        setTimeout(this.updateValues.bind(this), 1000);
        break;
    }

    this.settingMode = false;
  }

  async setThresholdTemperature(value: number): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setThresholdTemperature', value);

    const zone = this.platform.service.hasMultiSetPoint
      ? this.platformAccessory.context.zone
      : 'U';

    await this.setModeComplete();
    await this.platform.service.setTargetTemperature(value, zone);
  }

  async setModeComplete(): Promise<void> {
    this.platform.log.debug(this.constructor.name, 'setModeComplete');

    if (!this.settingMode) {
      return;
    }

    const start = Date.now();
    while (Date.now() - start < 10000) {
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      if (!this.settingMode) {
        break;
      }
    }
  }

  updateValues(): void {
    this.platform.log.debug(this.constructor.name, 'updateValues');

    super.updateValues();

    this.service
      .getCharacteristic(this.platform.Characteristic.Active)
      .updateValue(this.getActive());

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .updateValue(this.getCurrentHeaterCoolerState());

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .updateValue(this.getTargetHeaterCoolerState());

    this.service
      .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .updateValue(this.getThresholdTemperature());

    this.service
      .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .updateValue(this.getThresholdTemperature());
  }
}