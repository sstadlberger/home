var xmpp_client = require('node-xmpp-client');
var ltx = require('ltx');
var helper = require('./helper.js');
var config = require('./config.js');


/**
 * construct and sends a request for the master update
 */
var all = function () {
	var allData = new xmpp_client.Element('iq', {
		type: 'set',
		to: 'mrha@busch-jaeger.de/rpc',
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
	
	module.parent.exports.sysap.send(allData);
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
				allDataText = allDataText.replace('<The following strings from F000 to FFFF are not to be translated!>', '&lt;The following strings from F000 to FFFF are not to be translated!&gt;');
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
								['inputs', 'outputs'].forEach(function (put) {
									helper.ltx.getElements(channel, [put, 'dataPoint']).forEach(function (dataPoint) {
										var dp = helper.ltx.getAttr(dataPoint, 'i');
										if (dp) {
											data.actuators[sn]['channels'][cn]['datapoints'][dp] = helper.ltx.getElementText(dataPoint, ['value']);
										}
									});
								});
							}
						});
					}
				});
				
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
 * @param {Object} external - response-ready data structure for front-end
 */
var structure = function (data, structure) {
	for (var mode = 0; mode < structure.length; mode++) {
		if (structure[mode].floors) {
			for (var floor = 0; floor < structure[mode].floors.length; floor++) {
				if (structure[mode].floors[floor].buttons) {
					for (var button = 0; button < structure[mode].floors[floor].buttons.length; button++) {
						var status = structure[mode].floors[floor].buttons[button].status;
						if (!data.external[mode]) {
							data.external[mode] = [];
						}
						if (!data.external[mode][floor]) {
							data.external[mode][floor] = {};
						}
						// waiting for full destructuring support
						// currently only available with --harmony_destructuring (2016-03-26)
						// var [sn, ch, dp] = status.split('/');
						var parts = status.split('/');
						var sn = parts[0];
						var ch = parts[1];
						var dp = parts[2];
						if (data.actuators[sn] && data.actuators[sn].channels[ch] && data.actuators[sn].channels[ch].datapoints[dp] != undefined) {
							data.external[mode][floor][status] = data.actuators[sn].channels[ch].datapoints[dp];
						}
					}
				}
			}
		}
	}
	helper.log.debug('structure for interface updated');
}

module.exports.all = all;
module.exports.presence = presence;
module.exports.update = update;
module.exports.response = response;
module.exports.structure = structure;
