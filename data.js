var fs = require('fs');
var sysap_internal = require('./sysap-internal.js');

// this set of vars contains/will contain the master status
var data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));

var setDP = function (sn, cn, dp, value) {
	if (!data.actuators[sn]) {
		data.actuators[sn] = {
			'serialNumber': sn,
			'channels': {}
		};
	}
	if (!data.actuators[sn]['channels']) {
		data.actuators[sn]['channels'] = {};
	}
	if (!data.actuators[sn]['channels'][cn]) {
		data.actuators[sn]['channels'][cn] = {
			'datapoints': {}
		};
	}
	data.actuators[sn]['channels'][cn]['datapoints'][dp] = value;
	sysap_internal.status(data);
}

/**
 * returns a part of the master data structure
 * @param {string} what - valid values are house, actuators and strings for the respective sub-objects
 * @returns {Object} requested part of the master data object
 */
var getData = function (what) {
	return data[what];
}

var setData = function (what, whatData) {
	data[what] = whatData;
}

module.exports.data = data;
module.exports.setDP = setDP;
module.exports.getData = getData;
module.exports.setData = setData;
