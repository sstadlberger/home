var xmpp_client = require('node-xmpp-client');
var helper = require('./helper.js');
var sysap_internal = require('./sysap-internal.js');
var sysap = require('./sysap.js');


/**
 * returns a part of the master data structure
 * @param {string} what - valid values are house, actuators and strings for the respective sub-objects
 * @returns {Object} requested part of the master data object
 */
var info = function (what) {
	return sysap.getData(what);
};

/**
 * translates a human readable request into the actual knx commands and calls the "real" set-functions
 * @param {string} type - what kind of actuator (switch, switchgroup, dimmer, shutter, shuttergroup & scene)
 * @param {string} serialnumber - serial number of the actuator
 * @param {string} channel - channel number of the actuator
 * @param {string} action - what action should be performed (on, off, up, down, stop & set)
 * @returns {string} either what action was performed or error message
 */
var parse = function (type, serialnumber, channel, action) {
	var commands = {
		switch : {
			actions : {
				on : { idp0000 : 1 },
				off : { idp0000 : 0 },
				toggle : { idp0000 : 'x' }
			},
			deviceIds: [
				'B002', // Schaltaktor 4-fach, 16A, REG
				'100E' // Sensor/ Schaltaktor 2/1-fach
			]
		},
		switchgroup : {
			actions : {
				on : { odp0002 : 1 },
				off : { odp0002 : 0 },
				toggle : { odp0002 : 'x' }
			}
		},
		dimmer : {
			actions : {
				on : { idp0000 : 1 },
				off : { idp0000 : 0 },
				toggle : { idp0000 : 'x' },
				up : { idp0001 : 9 }, // relative dimming: 9 means dimm up by 100%
				down : { idp0001 : 1 }, // relative dimming: 9 means dimm down by 100%
				stop : { idp0001 : 0 } // relative dimming: 0 means stop dimming action
			},
			deviceIds: [
				'101C' // Dimmaktor 4-fach
			]
		},
		shutter : {
			actions : {
				up : { idp0000 : 0 },
				down : { idp0000 : 1 },
				stop : { idp0001 : 1 }
			},
			deviceIds: [
				'B001', // Jalousieaktor 4-fach, REG
				'1013' // Sensor/ Jalousieaktor 1/1-fach
			]
		},
		shuttergroup : {
			actions : {
				up : { odp0003 : 0 },
				down : { odp0003 : 1 },
				stop : { odp0004 : 1 }
			}
		},
		scene : {
			actions : {
				set : { odp0000 : 1 }
			}
		},
	}
	var actuators = info('actuators');
	
	// error checks
	if (!commands[type]) {
		helper.log.error('parse unknown command: "' + type + '"');
		return 'unknown command: "' + type + '"';
	}
	if (!commands[type].actions[action]) {
		helper.log.error('parse unknown action "' + action + '" for type "' + type + '"');
		return 'unknown action "' + action + '" for type "' + type + '"';
	}
	if (!actuators[serialnumber]) {
		helper.log.error('parse actuator "' + serialnumber + '" not found');
		return 'actuator "' + serialnumber + '" not found';
	}
	if (commands[type].deviceIds) {
		// this check is only valid for "real" actuators, i.e. hardware devices to which an input value is directly send
		// groups and scenes are virtual switches and send output datapoints over the bus
		if (commands[type].deviceIds.indexOf(actuators[serialnumber].deviceId) == -1) {
			helper.log.error('parse actuator "' + serialnumber + '" (' + actuators[serialnumber].typeName + ') is not of type "' + type + '"');
			return 'actuator "' + serialnumber + '" (' + actuators[serialnumber].typeName + ') is not of type "' + type + '"';
		}
	}
	
	var datapoint = Object.keys(commands[type].actions[action])[0];
	var value = commands[type].actions[action][datapoint];
	set(serialnumber, channel, datapoint, value);
	return 'set channel ' + channel + ' of ' + type + ' ' + serialnumber + ' (' + actuators[serialnumber].typeName + ') to ' + action + ': ' + serialnumber + '/' + channel + '/' + datapoint + ': ' + value;
}

/**
 * sets a knx parameter via xmpp
 * @param {string} serialnumber - serial number of the actuator
 * @param {string} channel - channel number of the actuator
 * @param {string} datapoint - datapoint of the actuator
 * @param {string} value - the value to set the datapoint to
 */
var set = function (serialnumber, channel, datapoint, value) {
	if (value == 'x') {
		// so far for all know toogle actions, the idp and opd have the same id so it's
		// possible to just switch the 'i' and 'o'
		var look = 'o' + datapoint.substr(1);
		var data = info('actuators');
		var current = data[serialnumber].channels[channel].datapoints[look];
		value = current == 1 ? 0 : 1;
	}
	var setData = new xmpp_client.Element('iq', {
		type: 'set',
		to: 'mrha@busch-jaeger.de/rpc',
	})
		.c('query', {
			xmlns: 'jabber:iq:rpc'
		})
			.c('methodCall', {})
				.c('methodName', {})
					.t('RemoteInterface.setDatapoint').up()
				.c('params', {})
					.c('param', {})
						.c('value', {})
							.c('string', {})
								.t(serialnumber + '/' + channel + '/' + datapoint)
								.up()
							.up()
						.up()
					.c('param', {})
						.c('value', {})
							.c('string', {})
								.t(value);
	
	sysap.sysap.send(setData);
	helper.log.debug('set actuator: ' + serialnumber + '/' + channel + '/' + datapoint + ': ' + value);
}

var updateStructure = function (broadcast) {
	sysap_internal.updateStructure(broadcast);
}

module.exports.info = info;
module.exports.parse = parse;
module.exports.set = set;
module.exports.updateStructure = updateStructure;
