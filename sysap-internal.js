var xmpp_client = require('node-xmpp-client');
var ltx = require('ltx');
var helper = require('./helper.js');
var config = require('./config.js');
var websocket = require('./socketapi.js');
var sysap = require('./sysap.js');
var fs = require('fs');
var util = require('util');


// see also var commands in sysap-external.js:parse()
var deviceTypes = {
	'B002': 'switch',
	'100E': 'switch',
	'101C': 'dimmer',
	'B001': 'shutter',
	'1013': 'shutter'
};
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
			'pm0000':  'upspeed',
			'pm0001': 'downspeed'
		}
	},
	'blind': {
		'dp': 'odp0001',
		'infos':  {
			'odp0002': 'angle',
			'pm0000':  'upspeed',
			'pm0001': 'downspeed',
			'pm0002': 'anglespeed'
		}
	}
};

/**
 * construct and sends a request for the master update
 */
var all = function () {
	var allData = new xmpp_client.Element('iq', {
		type: 'set',
		to: 'mrha@busch-jaeger.de/rpc'
	})
		.c('query', {
			xmlns: 'jabber:iq:rpc'
		})
			.c('methodCall', {})
				.c('methodName', {})
					.t('RemoteInterface.getAll').up()
				.c('params', {})
					.c('param', {})
						.c('value', {})
							.c('string', {})
								.t('de')
								.up()
							.up()
						.up()
					.c('param', {})
						.c('value', {})
							.c('int', {})
								.t('4')
								.up()
							.up()
						.up()
					.c('param', {})
						.c('value', {})
							.c('int', {})
								.t('0')
								.up()
							.up()
						.up()
					.c('param', {})
						.c('value', {})
							.c('int', {})
								.t('0');
	
	helper.log.trace(allData.toString());
	sysap.sysap.send(allData);
	helper.log.debug('request master update');
}

/**
 * parses a presence packet and logs the info
 * @param {Object} stanza - a node-xmpp-client xml data packet
 */
var presence = function (stanza) {
	
	var from = helper.ltx.getAttr(stanza, 'from');
	
	if (from) {
		if (from == config.bosh.jid + '/' + config.bosh.resource) {
			helper.log.debug('myself present');
		} else if (from == 'mrha@busch-jaeger.de/rpc') {
			helper.log.debug('sysap present');
		} else {
			helper.log.info('sysap unknown user present: ' + from);
		}
	} else {
		helper.log.warn('unknown presence packet');
		helper.log.trace(stanza.toString());
	}
	
}

/**
 * parses an update packet and updates the master data structure
 * requires a pre-populated actuators object
 * @param {Object} stanza - a node-xmpp-client xml data packet
 * @param {Object} data - the master data object
 */
var update = function (stanza, data) {

	helper.ltx.getElements(stanza, ['event', 'items', 'item']).forEach(function (item) {
		
		// parse payload
		// no XML verification, let's hope that Busch Jäger produces writes valid XML in this case
		var update = ltx.parse(helper.ltx.getElementText(item, ['update', 'data']));
		
		if (update) { 
			helper.log.debug('valid update paket');
			helper.ltx.getElements(update, ['devices', 'device']).forEach(function (device) {
				
				// is a valid device and init is completed
				var sn = helper.ltx.getAttr(device, 'serialNumber');
				if (sn && sn != '' && data.actuators[sn]) {
				
					// valid update packet that is of interest
					if (helper.ltx.getAttr(device, 'commissioningState') == 'ready') {
						
						// iterate over all channels and datapoints
						helper.ltx.getElements(device, ['channels', 'channel']).forEach(function (channel) {
							var cn = helper.ltx.getAttr(channel, 'i');
							if (cn) {
								channel.children.forEach(function (dp) {
									if (!data.actuators[sn]['channels'][cn]) {
										data.actuators[sn]['channels'][cn] = {
											datapoints: {}
										};
									}
									dp.getChildren('dataPoint').forEach(function (datapoint) {
										var pt = helper.ltx.getAttr(datapoint, 'i');
										var vl = helper.ltx.getElementText(datapoint, ['value']);
										if (pt && vl) {
											data.actuators[sn].channels[cn].datapoints[pt] = vl;
										}
									});
								});
							}
						});
					}
				}
			});
		}
	});
}

/**
 * parses the master packet and creates the master data struchture
 * @param {Object} stanza - a node-xmpp-client xml data packet
 * @param {Object} data - the master data object
 */
var response = function (stanza, data) {
	helper.ltx.getElements(stanza, ['query', 'methodResponse', 'params', 'param']).forEach(function (param) {
		
		helper.ltx.getElements(param, ['value', 'boolean']).forEach(function (value) {
			var result = value.getText();
			if (result == 1) {
				helper.log.debug('result update succes');
			} else if (result == 0) {
				helper.log.warn('result update failure');
			} else {
				helper.log.warn('result update unknown');
				helper.log.trace(result);
			}
		});
		
		helper.ltx.getElements(param, ['value', 'int']).forEach(function (value) {
				helper.log.warn('unknown int update');
				helper.log.trace(stanza.toString());
		});
		
		helper.ltx.getElements(param, ['value', 'string']).forEach(function (value) {
			
			var allDataText = value.getText();

			if (allDataText.length > 10240) {
				
				// valid XML is not necessary for all parsers, but it helps (and ltx is small and fast BECAUSE it doesn't accept shitty XML)
				allDataText = allDataText.replace('<Channel selector OR>', '&lt;Channel selector OR&gt;');
				allDataText = allDataText.replace('<Channel selector AND>', '&lt;Channel selector AND&gt;');
				allDataText = allDataText.replace('<Solar power device>', '&lt;Solar power device&gt;');
				allDataText = allDataText.replace('<Inverter sensor>', '&lt;Inverter sensor&gt;');
				allDataText = allDataText.replace('<Meter sensor>', '&lt;Meter sensor&gt;');
				allDataText = allDataText.replace('<Battery sensor>', '&lt;Battery sensor&gt;');
				allDataText = allDataText.replace('<Solar power production>', '&lt;Solar power production&gt;');
				allDataText = allDataText.replace('<Inverter output power>', '&lt;Inverter output power&gt;');
				allDataText = allDataText.replace('<Solar energy (today)>', '&lt;Solar energy (today)&gt;');
				allDataText = allDataText.replace('<Injected energy (today)>', '&lt;Injected energy (today)&gt;');
				allDataText = allDataText.replace('<Purchased energy (today)>', '&lt;Purchased energy (today)&gt;');
				allDataText = allDataText.replace('<Inverter alarm>', '&lt;Inverter alarm&gt;');
				allDataText = allDataText.replace('<Self-consumption>', '&lt;Self-consumption&gt;');
				allDataText = allDataText.replace('<Self-sufficiency>', '&lt;Self-sufficiency&gt;');
				allDataText = allDataText.replace('<Home power consumption>', '&lt;Home power consumption&gt;');
				allDataText = allDataText.replace('<Power to grid>', '&lt;Power to grid&gt;');
				allDataText = allDataText.replace('<Consumed energy (today)>', '&lt;Consumed energy (today)&gt;');
				allDataText = allDataText.replace('<Timer program switch sensor>', '&lt;Timer program switch sensor&gt;');
				allDataText = allDataText.replace('<Alert switch sensor>', '&lt;Alert switch sensor&gt;');
				allDataText = allDataText.replace('<Meter alarm>', '&lt;Meter alarm&gt;');
				allDataText = allDataText.replace('<Battery level>', '&lt;Battery level&gt;');
				allDataText = allDataText.replace('<Battery power>', '&lt;Battery power&gt;');
				allDataText = allDataText.replace('<During inverter alarm>', '&lt;During inverter alarm&gt;');
				allDataText = allDataText.replace('<No inverter alarm>', '&lt;No inverter alarm&gt;');
				allDataText = allDataText.replace('<During meter alarm>', '&lt;During meter alarm&gt;');
				allDataText = allDataText.replace('<No meter alarm>', '&lt;No meter alarm&gt;');
				allDataText = allDataText.replace('<Inverter alarm start>', '&lt;Inverter alarm start&gt;');
				allDataText = allDataText.replace('<Inverter alarm end>', '&lt;Inverter alarm end&gt;');
				allDataText = allDataText.replace('<Meter alarm start>', '&lt;Meter alarm start&gt;');
				allDataText = allDataText.replace('<Meter alarm end>', '&lt;Meter alarm end&gt;');
				allDataText = allDataText.replace('<Acoustic feedback>', '&lt;Acoustic feedback&gt;');
				allDataText = allDataText.replace('<Actuating Fan Stage Heating>', '&lt;Actuating Fan Stage Heating&gt;');
				allDataText = allDataText.replace('<Actuating Fan Manual On/Off Heating>', '&lt;Actuating Fan Manual On/Off Heating&gt;');
				allDataText = allDataText.replace('<Window/Door position>', '&lt;Window/Door position&gt;');
				allDataText = allDataText.replace('<Heating active>', '&lt;Heating active&gt;');
				allDataText = allDataText.replace('<Cooling active>', '&lt;Cooling active&gt;');
				allDataText = allDataText.replace('<Movement detector/blind actuator, 1-gang>', '&lt;Movement detector/blind actuator, 1-gang&gt;');
				allDataText = allDataText.replace('<Movement detector/dimming actuator, 1-gang>', '&lt;Movement detector/dimming actuator, 1-gang&gt;');
				allDataText = allDataText.replace('<The following strings from F000 to FFFF are not to be translated!>', '&lt;The following strings from F000 to FFFF are not to be translated!&gt;');
				
				helper.log.trace("\nmaster update payload:\n");
				helper.log.trace(allDataText);
				
				var allData = ltx.parse(allDataText);
			
				// floors and rooms
				helper.ltx.getElements(allData, ['entities', 'entity']).forEach(function (entity) {
					var entityData = JSON.parse(entity.getText());
					if (entity.attrs.type == 'floor' || entity.attrs.type == 'room') {
						data.house[entity.attrs.type][entity.attrs.uid] = entityData.name;
					}
				});
			
				// strings
				helper.ltx.getElements(allData, ['strings', 'string']).forEach(function (string) {
					data.strings[string.attrs.nameId] = string.getText();
				});
			
				// actuators
				helper.ltx.getElements(allData, ['devices', 'device']).forEach(function (device) {
				
					var sn = helper.ltx.getAttr(device, 'serialNumber');
					var deviceId = helper.ltx.getAttr(device, 'deviceId');
					if (sn) {
						var nameId = helper.ltx.getAttr(device, 'nameId');
						data.actuators[sn] = {
							serialNumber: sn,
							deviceId: deviceId,
							typeName: data.strings[nameId],
							channels: {}
						};
						helper.ltx.getElements(device, ['channels', 'channel']).forEach(function (channel) {
							var cn = helper.ltx.getAttr(channel, 'i');
							if (cn) {
								data.actuators[sn]['channels'][cn] = {
									datapoints: {}
								};
								['inputs', 'outputs', 'parameters'].forEach(function (put) {
									['dataPoint', 'parameter'].forEach(function (name) {
										helper.ltx.getElements(channel, [put, name]).forEach(function (dataPoint) {
											var dp = helper.ltx.getAttr(dataPoint, 'i');
											if (dp) {
												data.actuators[sn]['channels'][cn]['datapoints'][dp] = helper.ltx.getElementText(dataPoint, ['value']);
											}
										});
									});
								});
							}
						});
					}
				});
				
				updateStructure(true);
				helper.log.info('master update complete');
			} else {
				helper.log.warn('unknown string update');
				helper.log.trace(stanza.toString());
			}
		});
	});
}

/**
 * converts the master data object into bite-sized parts that are structured
 * for the front-end
 * @param {Object} data - the master data object
 * @param {Object} structure - the data structure of the front-end
 */
var status = function (data) {
	data.status = [];
	for (var mode = 0; mode < data.structure.length; mode++) {
		data.status[mode] = [];
		if (data.structure[mode].floors) {
			for (var floor = 0; floor < data.structure[mode].floors.length; floor++) {
				data.status[mode][floor] = {};
				if (data.structure[mode].floors[floor].buttons) {
					for (var button = 0; button < data.structure[mode].floors[floor].buttons.length; button++) {
						var buttonData = data.structure[mode].floors[floor].buttons[button];
						var sn = buttonData.sn;
						var cn = buttonData.cn;
						if (data.actuators[sn] && data.actuators[sn].channels[cn]) {
							var type = _typeHelper(data.actuators, deviceTypes[data.actuators[sn].deviceId], sn, cn);
							var dp = options[type].dp;
							if (data.actuators[sn].channels[cn] && data.actuators[sn].channels[cn].datapoints[dp] != undefined) {
								var value = data.actuators[sn].channels[cn].datapoints[dp];
								data.status[mode][floor][sn + '/' + cn] = {
									'value' : value
								};
								if (options[deviceTypes[data.actuators[sn].deviceId]].infos) {
									data.status[mode][floor][sn + '/' + cn].infos = {};
									var names = Object.keys(options[type].infos);
									for (var i = 0; i < names.length; i++) {
										if (typeof data.actuators[sn].channels[cn].datapoints[names[i]] !== undefined) {
											data.status[mode][floor][sn + '/' + cn].infos[options[type].infos[names[i]]] = data.actuators[sn].channels[cn].datapoints[names[i]];
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
	helper.log.debug('status for interface updated');
	websocket.broadcast(JSON.stringify({'status': data.status}));
}

var updateStructure = function (broadcast) {
	var actuators = sysap.getData('actuators');
	var loadedStructure = JSON.parse(fs.readFileSync('./structure.json', 'utf8'));
	var structure = [];
	for (var mode = 0; mode < loadedStructure.length; mode++) {
		structure[mode] = {};
		structure[mode].icon =  loadedStructure[mode].icon;
		structure[mode].iconActive = loadedStructure[mode].iconActive;
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
						var sn = currentButton.serialnumber;
						var cn = currentButton.channel;
						if (actuators[sn]) {
							structure[mode].floors[floor].buttons[button] = {};
							structure[mode].floors[floor].buttons[button].x = currentButton.x;
							structure[mode].floors[floor].buttons[button].y = currentButton.y;
							structure[mode].floors[floor].buttons[button].iconOn = currentButton.iconOn;
							structure[mode].floors[floor].buttons[button].iconOff = currentButton.iconOff;
							structure[mode].floors[floor].buttons[button].sn = sn;
							structure[mode].floors[floor].buttons[button].cn = cn;
							structure[mode].floors[floor].buttons[button].type = _typeHelper(actuators, deviceTypes[actuators[sn].deviceId], sn, cn);
							structure[mode].floors[floor].buttons[button].name = currentButton.name;
						}
					}
				}
			}
		}
	}
	helper.log.info('structure for interface updated');
	helper.log.trace(util.inspect(structure, {showHidden: false, depth: null}));
	sysap.setStructure(structure);
	if (broadcast) {
		websocket.broadcast(JSON.stringify({'structure': structure}));
	}
}

var _typeHelper = function (actuators, type, sn, ch) {
	if (type == 'shutter') {
		if (actuators[sn].channels[ch].datapoints['pm0002'] > 0) {
			type = 'blind';
		}
	}
	return type;
}

module.exports.all = all;
module.exports.presence = presence;
module.exports.update = update;
module.exports.response = response;
module.exports.status = status;
module.exports.updateStructure = updateStructure;
