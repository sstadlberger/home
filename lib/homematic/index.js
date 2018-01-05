/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 

var config = require('../../config/config');
var helper = require('../helper');

if (global.useHomematic) {
    var homematic = require('binrpc');
    var ip = require('ip');
    var localIP = ip.address();
    var connectionName = 'home';

    var ccuReceiver = homematic.createServer({ host: localIP, port: config.homematic.localPort });
    var ccu = homematic.createClient({ host: config.homematic.ccuIP, port: config.homematic.ccuPort });


    ccuReceiver.on('system.listMethods', function (err, params, callback) {
        helper.log.debug('[homematic] system.listMethods');
        callback(null, ['system.listMethods', 'system.multicall', 'event', 'listDevices']);
    });

    ccuReceiver.on('listDevices', function (err, params, callback) {
        helper.log.debug('[homematic] listDevices: ' + JSON.stringify(params));
        callback(null, []);
    });

    ccuReceiver.on('event', function (err, params, callback) {
        helper.log.debug('[homematic] event (single): ' + JSON.stringify(params));
        callback(null, '');
    });

    ccuReceiver.on('system.multicall', function (err, params, callback) {
        params[0].forEach(function (call) {
            helper.log.debug('[homematic] event (multi):  ' + call.methodName + JSON.stringify(call.params));
        });
        callback(null, '');
    });


    // make sure to always unsubscribe from ccu
    process.on('SIGINT', function () {
        _unsubscribe();
    });
}

/**
 * tells the ccu to send us all status updates
 */
var _subscribe = function () {
    helper.log.debug('homematic request subscribe: xmlrpc_bin://' + localIP + ':' + config.homematic.localPort + ' with connectionName ' + connectionName);
    ccu.methodCall('init', ['xmlrpc_bin://' + localIP + ':' + config.homematic.localPort, connectionName], function (err, res) {
        if (err) {
            helper.log.error(err);
        }
        if (res) {
            helper.log.debug(res);
        }
    });
}

/**
 * tells the ccu to send us no more status updates
 * should be called at exit to not block ccu resources
 */
var _unsubscribe = function () {
    helper.log.debug('homematic request unsubscribe');
    ccu.methodCall('init', ['xmlrpc_bin://' + localIP + ':' + config.homematic.localPort, ''], function (err, res) {
        if (err) {
            helper.log.error(err);
        }
        if (res) {
            helper.log.debug(res);
        }
        process.exit(0);
    });
    setTimeout(function () {
        helper.log.error('force quit');
        process.exit(1);
    }, 1000);
}

if (global.useHomematic) {
	_subscribe();
}
