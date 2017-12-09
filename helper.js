/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const util = require('util'); 

var ltx = {};

ltx.getElement = function (element, path) {
	var current = path.shift();
	var result = element.getChild(current);
	if (result && path.length > 0) {
		result = this.getElement(result, path);
	}
	return result;
}

ltx.getElements = function (element, path) {
	var result;
	var current = path.shift();
	
	if (path.length == 0 && element.getChildren(current)) {
		result = element.getChildren(current);
	} else {
		result = element.getChild(current);
		if (result && path.length > 0) {
			result = this.getElements(result, path);
		}
	}
	if (!result) {
		result = [];
	}

	return result;
}

ltx.getAttr = function (object, attribute) {
	var result;
	if (object && object.attrs && object.attrs[attribute]) {
		result = object.attrs[attribute];
	}
	return result;
}

ltx.getElementAttr = function (element, path, attribute) {
	return this.getAttr(this.getElement(element, path), attribute);
}

ltx.getText = function (object) {
	var result;
	if (object && object.text()) {
		result = object.text();
	}
	return result;
}

ltx.getElementText = function (element, path) {
	return this.getText(this.getElement(element, path));
}

module.exports.ltx = ltx;


var log = {};

log.loglevel = {
	'all' : 1024,
	'trace' : 32,
	'debug' : 16,
	'info' : 8,
	'warn' : 4,
	'error' : 2,
	'fatal' : 1
};

log.printlog = function (level, message, dontPrintFull) {
	if (this.loglevel[level] <= global.loglevel) {
		prefix = ('[' + level + ']  ').slice(0, 8);
		var now = new Date();
		var datestring = now.toISOString().slice(0, 10) + ' ' + now.toLocaleTimeString() + ' ';
		if (message != null && typeof(message) == 'object') {
			message = util.inspect(message, { depth: null, colors: true });
			message = "\n" + message;
		}
		if (!global.logFilter || message.includes(global.logFilter)) {
			console.log(datestring + prefix + message);
		}
	}
}

log.trace = function (message, dontPrintFull) {
	this.printlog('trace', message, dontPrintFull);
}

log.debug = function (message, dontPrintFull) {
	this.printlog('debug', message, dontPrintFull);
}

log.info = function (message, dontPrintFull) {
	this.printlog('info', message, dontPrintFull);
}

log.warn = function (message, dontPrintFull) {
	this.printlog('warn', message, dontPrintFull);
}

log.error = function (message, dontPrintFull) {
	this.printlog('error', message, dontPrintFull);
}

log.fatal = function (message, dontPrintFull) {
	this.printlog('fatal', message, dontPrintFull);
}

module.exports.log = log;
