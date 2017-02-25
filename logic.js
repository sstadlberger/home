/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var data = require('./data.js');
var config = require('./config.js');
var helper = require('./helper.js');
var SunCalc = require('suncalc');


/**
 * calculates the sunlight phases via the SunCalc module and updates 
 * the isDay and isNight variables in the master data object. The raw
 * output is also put into the object.
 * Dusk and dawn are used as borders as they are most practical in real
 * world use (outside light levels).
 */
var updateDayNight = function () {
    var current = new Date();
	var times = SunCalc.getTimes(current, config.location.lat, config.location.long);

    if (current > times.dawn && current < times.dusk) {
        times.isDay = true;
        times.isNight = false;
    } else {
        times.isDay = false;
        times.isNight = true;
    }

    data.setData('daynight', times);

    helper.log.info('day & night updated');
    helper.log.trace(times);

	setTimeout(updateDayNight, 1 * 60 * 1000);
}


updateDayNight();
