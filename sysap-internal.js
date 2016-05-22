var xmpp_client = require('node-xmpp-client');
var ltx = require('ltx');
var sysap = require('./sysap.js');
var helper = require('./helper.js');
var config = require('./config.js');
var websocket = require('./socketapi.js');
var data = require('./data.js');
var fs = require('fs');
var util = require('util');


// see also var commands in sysap-external.js:parse()
var deviceTypes = {
	'B002': 'switch',
	'100E': 'switch',
	'101C': 'dimmer',
	'B001': 'shutter',
	'1013': 'shutter',
	'9004': 'thermostat',
	'DS18B20': 'temperature',
	'4800': 'scene'
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
			'odp0002': 'x-angle',
			'pm0002': 'x-fullclosed',
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
			'pm0002': 'fullclosed',
			'odp0000': 'moving'
		}
	},
	'thermostat': {
		'dp': 'odp0007',
		'infos':  {
			'odp0003': 'x-set',
			'odp0000': 'x-heat',
			'odp0006': 'x-on',
			'odp0008': 'x-eco',
		}
	},
	'temperature': {
		'dp': 'odp0000'
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
	
	helper.log.trace('[SEND] ' + allData.root().toString());
	sysap.sysap.send(allData);
	helper.log.debug('request master update');
}

/**
 * construct and sends a subscribe request
 */
var subscribe = function () {
	var talkToMe =  new xmpp_client.Element('presence', {
		'from': config.bosh.jid,
		'type': 'subscribe',
		'to': 'mrha@busch-jaeger.de/rpc',
		'xmlns': 'jabber:client'
	});
	helper.log.trace('[SEND] ' + talkToMe.root().toString());
	sysap.sysap.send(talkToMe);
	
	var talkToMe2 =  new xmpp_client.Element('presence', {
		'xmlns': 'jabber:client'
	})
		.c('c', {
			'xmlns': 'http://jabber.org/protocol/caps',
			'ver': '1.0',
			'node': 'http://gonicus.de/caps',
		});
	helper.log.trace('[SEND] ' + talkToMe2.root().toString());
	sysap.sysap.send(talkToMe2);
	
	helper.log.debug('request subscribe');
}

/**
 * construct and sends a subscribe confirmation
 */
var subscribed = function () {
	var talkToMe =  new xmpp_client.Element('presence', {
		'from': config.bosh.jid,
		'type': 'subscribed',
		'to': 'mrha@busch-jaeger.de/rpc',
		'xmlns': 'jabber:client'
	});
	helper.log.trace('[SEND] ' + talkToMe.root().toString());
	sysap.sysap.send(talkToMe);
	
	helper.log.debug('confirm subscribe');
}

/**
 * parses a presence packet and logs the info
 * @param {Object} stanza - a node-xmpp-client xml data packet
 * @returns {Boolean} true if sysap is shown as present, otherwise false
 */
var presence = function (stanza) {
	
	var back = false;
	
	var from = helper.ltx.getAttr(stanza, 'from');
	
	if (from) {
		if (from == config.bosh.jid + '/' + config.bosh.resource) {
			helper.log.debug('myself present');
		} else if (from == 'mrha@busch-jaeger.de/rpc') {
			helper.log.debug('sysap present');
			back = true;
		} else {
			helper.log.info('sysap unknown user present: ' + from);
		}
	} else {
		helper.log.warn('unknown presence packet');
		helper.log.trace(stanza.toString());
	}
	return back;
}

/**
 * parses an update packet and updates the master data structure
 * requires a pre-populated actuators object
 * @param {Object} stanza - a node-xmpp-client xml data packet
 * @param {Object} data - the master data object
 */
var update = function (stanza, d) {

	helper.ltx.getElements(stanza, ['event', 'items', 'item']).forEach(function (item) {
		
		// parse payload
		// no XML verification, let's hope that Busch Jäger produces writes valid XML in this case
		var update = ltx.parse(helper.ltx.getElementText(item, ['update', 'data']));
		
		if (update) { 
			helper.log.debug('valid update paket');
			helper.ltx.getElements(update, ['devices', 'device']).forEach(function (device) {
				
				// is a valid device and init is completed
				var sn = helper.ltx.getAttr(device, 'serialNumber');
				if (sn && sn != '' && d.actuators[sn]) {
				
					// valid update packet that is of interest
					if (helper.ltx.getAttr(device, 'commissioningState') == 'ready') {
						
						// iterate over all channels and datapoints
						helper.ltx.getElements(device, ['channels', 'channel']).forEach(function (channel) {
							var cn = helper.ltx.getAttr(channel, 'i');
							if (cn) {
								channel.children.forEach(function (dp) {
									if (!d.actuators[sn]['channels'][cn]) {
										d.actuators[sn]['channels'][cn] = {
											datapoints: {}
										};
									}
									dp.getChildren('dataPoint').forEach(function (datapoint) {
										var pt = helper.ltx.getAttr(datapoint, 'i');
										var vl = helper.ltx.getElementText(datapoint, ['value']);
										if (pt && vl) {
											d.actuators[sn].channels[cn].datapoints[pt] = vl;
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
var response = function (stanza, d) {
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
						d.house[entity.attrs.type][entity.attrs.uid] = entityData.name;
					}
				});
			
				// strings
				helper.ltx.getElements(allData, ['strings', 'string']).forEach(function (string) {
					d.strings[string.attrs.nameId] = string.getText();
				});
			
				// actuators
				helper.ltx.getElements(allData, ['devices', 'device']).forEach(function (device) {
				
					var sn = helper.ltx.getAttr(device, 'serialNumber');
					var deviceId = helper.ltx.getAttr(device, 'deviceId');
					if (sn) {
						var typeName = d.strings[nameId];
						var serialNumber = sn;
						var valid = true;
						if (sn.substring(0, 4) == 'FFFF') {
							// Scene
							helper.ltx.getElements(device, ['channels', 'channel', 'attribute']).forEach(function (attribute) {
								// Scene needs a valid name as identifer
								if (helper.ltx.getAttr(attribute, 'name') == 'displayName') {
									var name = helper.ltx.getText(attribute);
									typeName = 'Scene: ' + name;
									name = name.replace(/\s+/g, '');
									sn = 'SCENE' + name;
									if (name == '' || d.actuators[sn]) {
										helper.log.warn('scene ' + serialNumber + ' was not added because the name was not unique: ' + sn);
										valid = false;
									}
								}
							});
						}
						if (valid) {
							var nameId = helper.ltx.getAttr(device, 'nameId');
							d.actuators[sn] = {
								serialNumber: serialNumber,
								deviceId: deviceId,
								typeName: typeName,
								channels: {}
							};
							helper.ltx.getElements(device, ['channels', 'channel']).forEach(function (channel) {
								var cn = helper.ltx.getAttr(channel, 'i');
								if (cn) {
									d.actuators[sn]['channels'][cn] = {
										datapoints: {}
									};
									['inputs', 'outputs', 'parameters'].forEach(function (put) {
										['dataPoint', 'parameter'].forEach(function (name) {
											helper.ltx.getElements(channel, [put, name]).forEach(function (dataPoint) {
												var dp = helper.ltx.getAttr(dataPoint, 'i');
												if (dp) {
													d.actuators[sn]['channels'][cn]['datapoints'][dp] = helper.ltx.getElementText(dataPoint, ['value']);
												}
											});
										});
									});
								}
							});
						}
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
var status = function (d) {
	d.status = [];
	var structure = [];
	var shortcuts = [];
	Object.assign(structure, d.structure.structure);
	Object.assign(shortcuts, d.structure.shortcuts);
	structure.push({'floors': [{'buttons': shortcuts}]});
	for (var mode = 0; mode < structure.length; mode++) {
		d.status[mode] = [];
		if (structure[mode].floors) {
			for (var floor = 0; floor < structure[mode].floors.length; floor++) {
				d.status[mode][floor] = {};
				if (structure[mode].floors[floor].buttons) {
					for (var button = 0; button < structure[mode].floors[floor].buttons.length; button++) {
						var buttonData = structure[mode].floors[floor].buttons[button];
						if (buttonData) {
							var sn = buttonData.sn;
							var cn = buttonData.cn;
							if (d.actuators[sn] && d.actuators[sn].channels && d.actuators[sn].channels[cn]) {
								var type = _typeHelper(d.actuators, deviceTypes[d.actuators[sn].deviceId], sn, cn);
								var dp = options[type].dp;
								if (d.actuators[sn].channels[cn] && d.actuators[sn].channels[cn].datapoints[dp] != undefined) {
									var value = d.actuators[sn].channels[cn].datapoints[dp];
									if (type == 'thermostat') {
										value = Math.round(value * 10) / 10;
									}
									d.status[mode][floor][sn + '/' + cn] = {
										'value' : value
									};
									if (options[deviceTypes[d.actuators[sn].deviceId]].infos) {
										d.status[mode][floor][sn + '/' + cn].infos = {};
										var names = Object.keys(options[type].infos);
										for (var i = 0; i < names.length; i++) {
											if (typeof d.actuators[sn].channels[cn].datapoints[names[i]] !== undefined) {
												var value = d.actuators[sn].channels[cn].datapoints[names[i]];
												var name = options[type].infos[names[i]];
												if (name.substr(0, 2) == 'x-') {
													if (type == 'shutter') {
														if (structure[mode].floors[floor].buttons[button].extra != 'single') {
															if (name == 'x-angle') {
																// use custom calibration for "nearly-closed" state
																// i.e. when a little bit of light shines through the slots in the shutters
																var dark = buttonData.extra;
																var runtime = d.actuators[sn].channels[cn].datapoints['pm0001'];
																var realTime = runtime - dark;
																var offset = realTime / runtime;
																var currentValue = d.status[mode][floor][sn + '/' + cn].value;
													
																var currentTime = runtime * (currentValue / 100);
																if (currentTime < realTime) {
																	value = 0;
																} else {
																	var over = currentTime - realTime;
																	value = over / dark * 100;
																}
													
																var realValue = currentValue / offset;
																d.status[mode][floor][sn + '/' + cn].value = Math.min(realValue, 100);
															} else if (name == 'x-fullclosed') {
																value = structure[mode].floors[floor].buttons[button].extra * 1000;
															}
														}
													} else if (type == 'thermostat') {
														if (name == 'x-set') {
															value = 21 + parseFloat(d.actuators[sn].channels[cn].datapoints['odp0003']);
															if (d.actuators[sn].channels[cn].datapoints['odp0008'] == 68 && d.actuators[sn].channels[cn].datapoints['odp0006'] == 1) {
																// show the real eco target temperature
																value = value - parseFloat(d.actuators[sn].channels[cn].datapoints['pm0000']);
															}
															if (d.actuators[sn].channels[cn].datapoints['odp0006'] != 1) {
																// off
																value = 0;
															}
														} else if (name == 'x-heat') {
															value = d.actuators[sn].channels[cn].datapoints['odp0000'] > 0 ? true : false;
														} else if (name == 'x-on') {
															value = d.actuators[sn].channels[cn].datapoints['odp0006'] == 1 ? true : false;
														} else if (name == 'x-eco') {
															value = false;
															if ((d.actuators[sn].channels[cn].datapoints['odp0008'] == 68 || d.actuators[sn].channels[cn].datapoints['odp0008'] == 36) && d.actuators[sn].channels[cn].datapoints['odp0006'] == 1) {
																value = true;
															}
														}
													}
													name = name.substr(2);
												}
												d.status[mode][floor][sn + '/' + cn].infos[name] = value;
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
	helper.log.debug('status for interface updated');
	websocket.broadcast(JSON.stringify({'status': d.status}));
}

var updateStructure = function (broadcast) {
	var loadedMain = JSON.parse(fs.readFileSync('./structure.json', 'utf8'));
	var actuators = data.getData('actuators');
	
	var loadedStructure = loadedMain.structure;
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
	data.setData('structure', main);
	if (broadcast) {
		websocket.broadcast(JSON.stringify({'structure': main}));
	}
}

var _buttonhelper = function (currentButton, actuators) {
	var result = {};
	var sn = currentButton.serialnumber;
	var cn = currentButton.channel;
	result = {};
	result.x = currentButton.x;
	result.y = currentButton.y;
	result.iconOn = currentButton.iconOn;
	result.iconOff = currentButton.iconOff;
	result.sn = sn;
	result.cn = cn;
	result.type = _typeHelper(actuators, deviceTypes[actuators[sn].deviceId], sn, cn, currentButton.extra);
	result.name = currentButton.name;
	if (typeof currentButton.extra !== undefined) {
		result.extra = currentButton.extra;
	}
	return result;
}

var _typeHelper = function (actuators, type, sn, ch, extra) {
	switch (type) {
		case 'shutter':
			if (typeof extra !== undefined && extra == 'single') {
				type = 'motor';
			} else if (actuators[sn].channels[ch].datapoints['pm0002'] > 0) {
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

module.exports.all = all;
module.exports.presence = presence;
module.exports.subscribe = subscribe;
module.exports.subscribed = subscribed;
module.exports.update = update;
module.exports.response = response;
module.exports.status = status;
module.exports.updateStructure = updateStructure;
