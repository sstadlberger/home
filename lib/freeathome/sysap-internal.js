/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var xmpp_client = require('node-xmpp-client');
var ltx = require('ltx');
var sysap = require('../freeathome');
var helper = require('../helper');
var config = require('../../config/config');
var data = require('../data');
var websocket = require('../api/socketapi');



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
 *
 * @param {Object} stanza - a node-xmpp-client xml data packet
 */
var update = function (stanza) {
	var actuators = data.getData('actuators');

	helper.ltx.getElements(stanza, ['event', 'items', 'item']).forEach(function (item) {

		// parse payload
		// no XML verification, let's hope that Busch Jaeger sends valid XML in this case
		var update = ltx.parse(helper.ltx.getElementText(item, ['update', 'data']));
		helper.log.trace('[RECEIVED Payload] ' + update.toString());

		if (update) {
			helper.log.debug('valid update paket');
			websocketMessage = {};
			helper.ltx.getElements(update, ['devices', 'device']).forEach(function (device) {

				// is a valid device and init is completed
				var sn = helper.ltx.getAttr(device, 'serialNumber');
				if (sn && sn != '' && actuators[sn]) {

					// valid update packet that is of interest
					if (helper.ltx.getAttr(device, 'commissioningState') == 'ready') {

						websocketMessage[sn] = {
							serialNumber: actuators[sn]['serialNumber'],
							deviceId: actuators[sn]['deviceId'],
							typeName: actuators[sn]['typeName'],
							channels: {}
						};

						// iterate over all channels and datapoints
						helper.ltx.getElements(device, ['channels', 'channel']).forEach(function (channel) {
							var cn = helper.ltx.getAttr(channel, 'i');
							if (cn) {
								if (!websocketMessage[sn]['channels'][cn]) {
									websocketMessage[sn]['channels'][cn] = {
										'datapoints': {}
									};
								}

								channel.children.forEach(function (dp) {
									dp.getChildren('dataPoint').forEach(function (datapoint) {
										var pt = helper.ltx.getAttr(datapoint, 'i');
										var vl = helper.ltx.getElementText(datapoint, ['value']);
										if (pt && vl) {
											data.setDatapoint(sn, cn, pt, vl);
											websocketMessage[sn]['channels'][cn]['datapoints'][pt] = vl;
										}
									});
								});
							}
						});
					}
				}
			});

			websocket.broadcast(JSON.stringify({'result': websocketMessage, 'type': 'update'}), false);
		}
	});

}

/**
 * parses the master packet and creates the master data structure
 *
 * @param {Object} stanza - a node-xmpp-client xml data packet
 */
var masterUpdate = function (stanza) {
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

				// strings
				var allStrings = {};
				helper.ltx.getElements(allData, ['strings', 'string']).forEach(function (string) {
					allStrings[string.attrs.nameId] = string.getText();
				});
				data.setData('strings', allStrings);

				// actuators
				helper.ltx.getElements(allData, ['devices', 'device']).forEach(function (device) {

					var sn = helper.ltx.getAttr(device, 'serialNumber');
					var deviceId = helper.ltx.getAttr(device, 'deviceId');
					if (sn) {
						var typeName = allStrings[helper.ltx.getAttr(device, 'nameId')];
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
									// it is a bit resource intensive to refetch the object all the time but the current version is always required :-(
									var actuators = data.getData('actuators');
									if (name == '' || actuators[sn]) {
										helper.log.warn('scene ' + serialNumber + ' was not added because the name was not unique: ' + sn);
										valid = false;
									}
								}
							});
						}
						if (valid) {
							if (data.createActuator(sn, serialNumber, deviceId, typeName)) {
								helper.ltx.getElements(device, ['channels', 'channel']).forEach(function (channel) {
									var cn = helper.ltx.getAttr(channel, 'i');
									if (cn) {
										['inputs', 'outputs', 'parameters'].forEach(function (put) {
											['dataPoint', 'parameter'].forEach(function (name) {
												helper.ltx.getElements(channel, [put, name]).forEach(function (dataPoint) {
													var dp = helper.ltx.getAttr(dataPoint, 'i');
													if (dp) {
														data.setDatapoint(sn, cn, dp, helper.ltx.getElementText(dataPoint, ['value']));
													}
												});
											});
										});
									}
								});
							}
						}
					}
				});

				data.updateStructure();
				helper.log.info('master update complete');
			} else {
				helper.log.warn('unknown string update');
				helper.log.trace(stanza.toString());
			}
		});
	});
}

module.exports.all = all;
module.exports.presence = presence;
module.exports.subscribe = subscribe;
module.exports.subscribed = subscribed;
module.exports.update = update;
module.exports.masterUpdate = masterUpdate;
