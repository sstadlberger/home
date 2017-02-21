/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var fs = require('fs');
var sysap_internal = require('./sysap-internal.js');
var websocket = require('./socketapi.js');

// this set of vars contains/will contain the master status
var data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));



/*
format of the data.json file and the coresponding data object

actuators: 
	all actuators and their status; this can come from multiple sources
	general format: serialnumber -> channel -> datapoint -> value
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

weather:
	contains a data response from the Dark Sky API
	see here for the documentation: https://darksky.net/dev/docs
*/



/**
 * sets a datapoint for a given actuator and channel; the channel will be created if it does not exist
 * 
 * @param {string} serialNumberUnique - the unique identifier for the actuator; can be different from serialNumber if serialNumber is not unique (e.g. with Busch Jäger SysAP Scenes)
 * @param {string} channel - channel id (e.g. ch0000)
 * @param {string} datapoint - datapoint id (e.g. idp0000)
 * @param {*} value - the value the datapoint should be set to
 * @param {boolean} update - should a status update be triggered
 */
var setDatapoint = function (serialNumberUnique, channel, datapoint, value) {
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
		sysap_internal.status(data);
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
	if (what == 'weather' || what == 'status' || what == 'structure') {
		var sendData = {};
		sendData[what] = data[what];
		websocket.broadcast(JSON.stringify(sendData));
	}
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

module.exports.setDatapoint = setDatapoint;
module.exports.getData = getData;
module.exports.setData = setData;
module.exports.createActuator = createActuator;
