/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var https = require('https');
var data = require('./data.js');
var config = require('./config.js');
var helper = require('./helper.js');

var updateWeather = function () {

	https.get({
		host: config.weather.host,
		path: config.weather.path
	}, function (response) {
		var raw = '';
		response.on('data', function (d) {
			raw += d;
		});
		response.on('end', function () {
			var json = JSON.parse(raw);
			helper.log.trace(json);
			var temp = { max: -999, min: 999 };
			json.hourly.data.forEach(function (item) {
				temp.max = Math.max(temp.max, item.temperature);
				temp.min = Math.min(temp.min, item.temperature);
			});
			json.hourly.temperature = temp;
			// weather is stored in datapoints so it can be used in triggers
			Object.keys(json).forEach(function (key) {
				data.setDatapoint('weather', 'ch0000', key, json[key]);
			});
			// broadcasts the weather
			data.getWeather(true);
			helper.log.info('weather updated');
		});
	}).on('error', function (e) {
		helper.log.error('error updating weather: ' + e.message);
	});

	setTimeout(updateWeather, 10 * 60 * 1000);
}

if (global.useWeather) {
	updateWeather();
}
