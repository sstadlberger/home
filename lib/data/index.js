/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var fs = require('fs');
var websocket = require('../api/socketapi');
var helper = require('../helper');
var util = require('util');

// this set of vars contains/will contain the master status
var data = JSON.parse(fs.readFileSync('config/data.json', 'utf8'));

// see also var commands in sysap-external.js:parse()
var options = {
	'switch': {
		'dp': 'odp0000'
	},
	'dimmer': {
		'dp': 'odp0001'
	},
	'shutter': {
		'dp': 'odp0001',
		'infos':  {
			'odp0002': 'x-angle',
			'pm0003': 'x-fullclosed',
			'pm0000':  'upspeed',
			'pm0001': 'downspeed',
			'odp0000': 'moving'
		}
	},
	'blind': {
		'dp': 'odp0001',
		'infos':  {
			'odp0002': 'angle',
			'pm0000':  'upspeed',
			'pm0001': 'downspeed',
			'pm0003': 'fullclosed',
			'odp0000': 'moving'
		}
	},
	'thermostat': {
		'dp': 'odp0010',
		'infos':  {
			'odp0007': 'x-set',
			'odp0000': 'x-heat',
			'odp0008': 'x-on',
			'odp0009': 'x-eco',
		}
	},
	'temperature': {
		'dp': 'odp0000'
	},
	'humidity': {
		'dp': 'odp0000'
	}
};
var deviceTypes = {
	'B002': 'switch',
	'100E': 'switch',
	'B008': 'switch',
	'10C4': 'switch',
	'101C': 'dimmer',
	'1021': 'dimmer',
	'1019': 'dimmer',
	'1017': 'dimmer',
	'10C0': 'dimmer',
	'B001': 'shutter',
	'1013': 'shutter',
	'9004': 'thermostat',
	'DS18B20': 'temperature',
	'DHT11': 'humidity',
	'4800': 'scene'
};

/*
format of the data.json file and the coresponding data object

actuators: 
	all actuators and their status; this can come from multiple sources
	general format: serialnumber -> channel -> datapoint -> value
	There is a special case for weather. It is stored as an actuator with the sn set to 
	weather and all data is in the datapoint of ch0000
	actuators: {
		SERIALNUMBER: {
			serialNumber: "SERIALNUMBER",
			deviceId: "DEVICEID",
			channels: {
				CHANNEL: {
					datapoints: {
						DATAPOINT: "VALUE",
						...
					}
				},
				...
			}
		},
		weather: {
			serialNumber: "weather",
			channels: {
				ch0000: {
					datapoints: {
						contains a data response from the Dark Sky API
						see here for the documentation: https://darksky.net/dev/docs
					}
				}
			}
		}
	}
	e.g.: actuators['serialnumber']['channels']['ch0000']['datapoints']['idp0000'] = "X"
	
strings:
	directly derived from BJ SysAP
	strings: {
		0001: "Schaltaktor",
		0002: "Ein",
		...
	}
	
status:
	used as status message for frontend; format is analogous to "structure"
	general format: mode (light, shutter, heating and shortcuts) -> floor -> object (defined as SERIALNUMBER/CHANNEL) -> value
	status: [
		[
			{
				SERIALNUMBER/CHANNEL: {
					value: "VALUE"
				},
				...
			},
			...
		],
		...
	]

trigger:
	contains a set of conditions and actions
	t.b.d.

structure:
	contains the information to render the frontend; format is analogous to "status"
	general format: mode (light, shutter, heating and statusbar) -> floor -> object (defined as SERIALNUMBER/CHANNEL) -> value
	also contains separate information for the mode or object (icons, position, labels, etc.)
	structure: {
		structure: [
			{
				icon: "ICON.SVG",
				iconActive: "ICONACTIVE.SVG",
				floors: [
					{
						name: "FLOORNAME",
						background: "BACKGROUNDIMAGE.PNG",
						buttons: [
							{
								x: "XCOORDINATEOFBOTTON",
								y: "YCOORDINATEOFBOTTON",
								iconOn: "ICON.SVG",
								iconOff: "ICONOFF.SVG",
								sn: "SERIALNUMBER",
								cn: "CHANNEL",
								type: "TYPE",
								name: "DISPLAY NAME"
							},
							...
						]
					},
					...
				]
			},
			...
		],
		shortcuts: [
		{
			iconOn: "ICON.SVG",
			iconOff: "ICONOFF.SVG",
			sn: "SERIALNUMBER",
			cn: "CHANNEL",
			type: "TYPE",
			name: "DISPLAY NAME"
		},
		...
		]
	}

daynight:
	contains the sunset & sunrise data
	nadir: Date Object
	nightEnd: Date Object
	nauticalDawn: Date Object
	dawn: Date Object
	sunrise: Date Object
	sunriseEnd: Date Object
	goldenHourEnd: Date Object
	solarNoon: Date Object
	goldenHour: Date Object
	sunsetStart: Date Object
	sunset: Date Object
	dusk: Date Object
	nauticalDusk: Date Object
	night: Date Object
	isDay: boolean
	isNight: boolean
*/



/**
 * sets a datapoint for a given actuator and channel; the channel will be created if it does not exist
 * 
 * @param {string} serialNumberUnique - the unique identifier for the actuator; can be different from serialNumber if serialNumber is not unique (e.g. with Busch Jäger SysAP Scenes)
 * @param {string} channel - channel id (e.g. ch0000)
 * @param {string} datapoint - datapoint id (e.g. idp0000)
 * @param {*} value - the value the datapoint should be set to
 * @param {boolean} [update] - should a status update be triggered (optional)
 */
var setDatapoint = function (serialNumberUnique, channel, datapoint, value, update) {
	if (!data.actuators[serialNumberUnique]) {
		data.actuators[serialNumberUnique] = {
			'serialNumber': serialNumberUnique,
			'channels': {}
		};
	}
	if (!data.actuators[serialNumberUnique]['channels']) {
		data.actuators[serialNumberUnique]['channels'] = {};
	}
	if (!data.actuators[serialNumberUnique]['channels'][channel]) {
		data.actuators[serialNumberUnique]['channels'][channel] = {
			'datapoints': {}
		};
	}
	data.actuators[serialNumberUnique]['channels'][channel]['datapoints'][datapoint] = value;

	if (typeof(update) !== 'undefined' && update === true) {
		status(data);
	}
}

/**
 * returns a part of the master data structure
 * 
 * @param {string} what - valid values are house, actuators and strings for the respective sub-objects
 * 
 * @returns {Object} requested part as a copy of the master data object
 */
var getData = function (what) {
	return JSON.parse(JSON.stringify(data[what]));
}

/**
 * sets a top level section of the master data structure to the given object
 * an update to the "weather", "status" or "structure" section will trigger a client update via websocket
 * setting the data with this function will just overwrite the current data and not trigger any triggers
 * 
 * @param {string} what - which section should be updated
 * @param {Object} whatData - the object which will replace the current data
 */
var setData = function (what, whatData) {
	data[what] = whatData;
	if (what == 'weather' || what == 'status' || what == 'structure' || what == 'daynight') {
		var sendData = {};
		sendData[what] = data[what];
		websocket.broadcast(JSON.stringify(sendData));
	}
}

/**
 * sends out a weather update
 * weather is stored as an actuator with the sn set to 'weather' and the data is in ch0000
 * 
 * @param {boolean} broadcast - if set to true it will broadcast the weather data to all connected websocket clients
 * 
 * @returns {Object} - the complete weather data
 */
var getWeather = function (broadcast) {
	var weather = getActuatorData('weather', 'ch0000');
	if (broadcast) {
		var sendData = {};
		sendData['weather'] = weather;
		websocket.broadcast(JSON.stringify(sendData));
	}
	return weather;
}

/**
 * adds an actuator to the master data structure
 *  
 * @param {string} serialNumberUnique - the unique identifier for the actuator; can be different from serialNumber if serialNumber is not unique (e.g. with Busch Jäger SysAP Scenes)
 * @param {string} serialNumber - serial number of the actuator
 * @param {string} deviceId - deviceid (Busch Jäger SysAP specific)
 * @param {string} typeName - typeName (Busch Jäger SysAP specific)
 * 
 * @returns {boolean} return true if successful and false if the actuator already exists
 */
var createActuator = function (serialNumberUnique, serialNumber, deviceId, typeName) {
	if (data.actuators[serialNumberUnique]) {
		return false;
	}
	data.actuators[serialNumberUnique] = {
		serialNumber: serialNumber,
		deviceId: deviceId,
		typeName: typeName,
		channels: {}
	};
	return true;
}

/**
 * reads a complete actuator structure and returns it
 * 
 * @param {string} serialNumberUnique - the unique identifier for the actuator; can be different from serialNumber if serialNumber is not unique (e.g. with Busch Jäger SysAP Scenes)
 * @param {string} [channel] - channel id (e.g. ch0000)
 * @param {string} [datapoint] - datapoint id (e.g. idp0000)
 * 
 * @returns {Object} - the complete data structure of the request
 */
var getActuatorData = function (serialNumberUnique, channel, datapoint) {
	if (channel && datapoint) {
		return data.actuators[serialNumberUnique]['channels'][channel]['datapoints'][datapoint];
	} else if (channel) {
		return data.actuators[serialNumberUnique]['channels'][channel]['datapoints'];
	} else {
		return data.actuators[serialNumberUnique]['channels'];
	}
}

/**
 * updates the structure object for the interface
 * The file structure.json is loaded and it contents are run agains the actuators from the main data structure.
 * The resulting object is saved to the main data structure and broadcast to all connected clients.
 */
var updateStructure = function () {
	var loadedMain = JSON.parse(fs.readFileSync('config/structure.json', 'utf8'));
	var actuators = getData('actuators');
	
	var loadedStructure = loadedMain.structure;
	var structure = [];
	for (var mode = 0; mode < loadedStructure.length; mode++) {
		structure[mode] = {};
		structure[mode].icon =  loadedStructure[mode].icon;
		structure[mode].iconActive = loadedStructure[mode].iconActive;
		structure[mode].iconDark =  loadedStructure[mode].iconDark;
		structure[mode].iconActiveDark = loadedStructure[mode].iconActiveDark;
		structure[mode].floors = [];
		if (loadedStructure[mode].floors) {
			for (var floor = 0; floor < loadedStructure[mode].floors.length; floor++) {
				var currentFloor = loadedStructure[mode].floors[floor];
				structure[mode].floors[floor] = {};
				structure[mode].floors[floor].name = currentFloor.name;
				structure[mode].floors[floor].background = currentFloor.background;
				structure[mode].floors[floor].buttons = [];
				if (loadedStructure[mode].floors[floor].buttons) {
					for (var button = 0; button < loadedStructure[mode].floors[floor].buttons.length; button++) {
						var currentButton = loadedStructure[mode].floors[floor].buttons[button];
						if (actuators[currentButton.serialnumber]) {
							structure[mode].floors[floor].buttons[button] = _buttonhelper(currentButton, actuators);
						}
					}
				}
			}
		}
	}
	
	var loadedShortcuts = loadedMain.shortcuts;
	var shortcuts = [];
	for (var sc = 0; sc < loadedShortcuts.length; sc++) {
		if (actuators[loadedShortcuts[sc].serialnumber]) {
			shortcuts.push(_buttonhelper(loadedShortcuts[sc], actuators));
		}
	}
	
	var main = {
		'structure': structure, 
		'shortcuts': shortcuts
	};
	
	helper.log.info('structure for interface updated');
	helper.log.trace(util.inspect(main, {showHidden: false, depth: null}));
	setData('structure', main);
}

/**
 * helps building a button object for the interface
 * the input button object will be basically enriched to its final form
 * a new object is returned and the input object will not be modified
 * 
 * @param {Object} currentButton - the input button object
 * @param {Object} actuators - an actuator object (see data.js)
 * 
 * @returns {Object}
 */
var _buttonhelper = function (currentButton, actuators) {
	var result = {};
	var sn = currentButton.serialnumber;
	var cn = currentButton.channel;
	result = {};
	result.x = currentButton.x;
	result.y = currentButton.y;
	result.iconOn = currentButton.iconOn;
	result.iconOff = currentButton.iconOff;
	result.iconOnDark = currentButton.iconOnDark;
	result.iconOffDark = currentButton.iconOffDark;
	result.sn = sn;
	result.cn = cn;
	result.type = _typeHelper(actuators, deviceTypes[actuators[sn].deviceId], sn, cn, currentButton.extra);
	result.name = currentButton.name;
	result.hide = (currentButton.hasOwnProperty('hide') && currentButton.hide ? true : false);
	if (typeof currentButton.extra !== undefined) {
		result.extra = currentButton.extra;
	}
	return result;
}

/**
 * converts the master data object into bite-sized parts that are structured for the front-end
 * The resulting object is stored in the main data structure and broadcast to all connected clients.
 */
var status = function () {
	var status = [];
	var allStructure = getData('structure');
	var actuators = getData('actuators');
	var structure = [];
	var shortcuts = [];
	Object.assign(structure, allStructure.structure);
	Object.assign(shortcuts, allStructure.shortcuts);
	structure.push({'floors': [{'buttons': shortcuts}]});
	for (var mode = 0; mode < structure.length; mode++) {
		status[mode] = [];
		if (structure[mode].floors) {
			for (var floor = 0; floor < structure[mode].floors.length; floor++) {
				status[mode][floor] = {};
				if (structure[mode].floors[floor].buttons) {
					for (var button = 0; button < structure[mode].floors[floor].buttons.length; button++) {
						var buttonData = structure[mode].floors[floor].buttons[button];
						if (buttonData) {
							var sn = buttonData.sn;
							var cn = buttonData.cn;
							if (actuators[sn] && actuators[sn].channels && actuators[sn].channels[cn]) {
								var type = _typeHelper(actuators, deviceTypes[actuators[sn].deviceId], sn, cn);
								var dp = options[type].dp;
								if (actuators[sn].channels[cn] && actuators[sn].channels[cn].datapoints[dp] != undefined) {
									var value = actuators[sn].channels[cn].datapoints[dp];
									if (type == 'thermostat') {
										value = Math.round(value * 10) / 10;
									}
									status[mode][floor][sn + '/' + cn] = {
										'value' : value
									};
									if (options[deviceTypes[actuators[sn].deviceId]].infos) {
										status[mode][floor][sn + '/' + cn].infos = {};
										var names = Object.keys(options[type].infos);
										for (var i = 0; i < names.length; i++) {
											if (typeof actuators[sn].channels[cn].datapoints[names[i]] !== undefined) {
												var value = actuators[sn].channels[cn].datapoints[names[i]];
												var name = options[type].infos[names[i]];
												if (name.substr(0, 2) == 'x-') {
													if (type == 'shutter') {
														if (structure[mode].floors[floor].buttons[button].extra != 'single') {
															if (name == 'x-angle') {
																// use custom calibration for "nearly-closed" state
																// i.e. when a little bit of light shines through the slots in the shutters
																var dark = buttonData.extra;
																var runtime = actuators[sn].channels[cn].datapoints['pm0001'];
																var realTime = runtime - dark;
																var offset = realTime / runtime;
																var currentValue = status[mode][floor][sn + '/' + cn].value;
													
																var currentTime = runtime * (currentValue / 100);
																if (currentTime < realTime) {
																	value = 0;
																} else {
																	var over = currentTime - realTime;
																	value = over / dark * 100;
																}
													
																var realValue = currentValue / offset;
																status[mode][floor][sn + '/' + cn].value = Math.min(realValue, 100);
															} else if (name == 'x-fullclosed') {
																value = structure[mode].floors[floor].buttons[button].extra * 1000;
															}
														}
													} else if (type == 'thermostat') {
														// room temperature: odp0010
														// set temperature: odp0007 (degrees above base temperature)
														// eco mode: odp0009:
														//		36 Eco heating on
														//		68 Eco heating off
														//		33 heating on
														//		65 heating off
														// is heating: odp0000 (0 = off; >0 = heating)
														// off: odp0008
														// base temperature: pm0002
														// eco temperature offset: pm0000
														if (name == 'x-set') {
															value = parseFloat(actuators[sn].channels[cn].datapoints['pm0002']) + parseFloat(actuators[sn].channels[cn].datapoints['odp0007']);
															// if eco is on (68 = heating is off, 36 = heating is on)
															if (actuators[sn].channels[cn].datapoints['odp0009'] == 68 || actuators[sn].channels[cn].datapoints['odp0009'] == 36) {
																// show the real eco target temperature
																value = value - parseFloat(actuators[sn].channels[cn].datapoints['pm0000']);
															}
															if (actuators[sn].channels[cn].datapoints['odp0008'] != 1) {
																// off
																value = 0;
															}
														} else if (name == 'x-heat') {
															value = actuators[sn].channels[cn].datapoints['odp0000'] > 0 ? true : false;
														} else if (name == 'x-on') {
															value = actuators[sn].channels[cn].datapoints['odp0008'] == 1 ? true : false;
														} else if (name == 'x-eco') {
															value = false;
															// if eco is on (68 = heating is off, 36 = heating is on) and thermostat is not disabled
															if ((actuators[sn].channels[cn].datapoints['odp0009'] == 68 || actuators[sn].channels[cn].datapoints['odp0009'] == 36) && actuators[sn].channels[cn].datapoints['odp0008'] == 1) {
																value = true;
															}
														}
													}
													name = name.substr(2);
												}
												status[mode][floor][sn + '/' + cn].infos[name] = value;
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}
	helper.log.trace('status for interface updated');
	helper.log.trace(util.inspect(status, {showHidden: false, depth: null}));
	setData('status', status);
}

/**
 * sets the corrects sub-type of an actuator
 * 
 * @param {Object} actuators - an actuator object (see data.js)
 * @param {String} type - the type which will be converted
 * @param {String} sn - the actuator identifer
 * @param {String} ch - the channel of the actuator
 * @param {String|number} extra - any extra information
 * 
 * @returns {String} the converted sub-type
 */
var _typeHelper = function (actuators, type, sn, ch, extra) {
	switch (type) {
		case 'shutter':
			if (typeof extra !== undefined && extra == 'single') {
				type = 'motor';
			} else if (actuators[sn].channels[ch].datapoints['pm0003'] > 0) {
				// automatic blind detection only works if slat movement time (Lamellen-Fahrzeit) is set to a value greater than 0ms
				type = 'blind';
			}
			break;
		case 'switch':
			if (typeof extra !== undefined && extra == 'buzzer') {
				type = 'buzzer';
			}
			break;
	}
	return type;
}

module.exports.setDatapoint = setDatapoint;
module.exports.getData = getData;
module.exports.setData = setData;
module.exports.createActuator = createActuator;
module.exports.getActuatorData = getActuatorData;
module.exports.getWeather = getWeather;
module.exports.updateStructure = updateStructure;
module.exports.status = status;

var logic = require('./logic');
