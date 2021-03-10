/*
    This file is part of web3.js.

    web3.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    web3.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with web3.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/** @file atokenprovider.js
 * @authors:
 *   Marek Kotewicz <marek@parity.io>
 *   Marian Oancea
 *   Fabian Vogelsteller <fabian@ethereum.org>
 *   Robin Shen <shenlubing2002@163.com>
 * @date 2020
 */

var errors = require('web3-core-helpers').errors;
var XHR2 = require('xhr2-cookies').XMLHttpRequest; // jshint ignore: line
var http = require('http');
var https = require('https');
var Jsonrpc = require('./jsonrpc.js');
var dsBridge = require("dsbridge")

/**
 * ATokenProvider should be used to send rpc calls over http
 */
var ATokenProvider = function ATokenProvider(host, options) {
    options = options || {};
    this.withCredentials = options.withCredentials || false;
    this.timeout = options.timeout || 0;
    this.headers = options.headers;
    this.agent = options.agent;
    this.connected = false;
    // keepAlive is true unless explicitly set to false
    const keepAlive = options.keepAlive !== false;
    this.host = host || 'http://localhost:8545';
    if (!this.agent) {
        if (this.host.substring(0,5) === "https") {
            this.httpsAgent = new https.Agent({ keepAlive });
        } else {
            this.httpAgent = new http.Agent({ keepAlive });
        }
    }
};

ATokenProvider.prototype.setConfig = function(config){
    this.address = config.address;
    this.chainId = config.chainId;
}

ATokenProvider.prototype.setAddress = function(address){
    this.address = address;
    this.ready = !!address;
}

ATokenProvider.prototype.enable = function(){
    let _this = this;
    let payload = Jsonrpc.toPayload('eth_requestAccounts', []);
    return new Promise(function (resolve,reject) {
        _this.send(payload,function (error,response){
            if (!error) {
                resolve(response.result);
            } else {
               reject(error);
            }
        });
    });
}

ATokenProvider.prototype.sendResponse = function(msgId,address) {
    //Empty implementation
}

ATokenProvider.prototype.on = function() {
    //Empty implementation
}

ATokenProvider.prototype.isAToken = function() {
   return true;
}

ATokenProvider.prototype.isMetaMask = function() {
    return true;
}

ATokenProvider.prototype._prepareRequest = function(){
    var request;
    // the current runtime is a browser
    if (typeof XMLHttpRequest !== 'undefined') {
        request = new XMLHttpRequest();
    } else {
        request = new XHR2();
        var agents = {httpsAgent: this.httpsAgent, httpAgent: this.httpAgent, baseUrl: this.baseUrl};
        if (this.agent) {
            agents.httpsAgent = this.agent.https;
            agents.httpAgent = this.agent.http;
            agents.baseUrl = this.agent.baseUrl;
        }
        request.nodejsSet(agents);
    }
    request.open('POST', this.host, true);
    request.setRequestHeader('Content-Type','application/json');
    request.timeout = this.timeout;
    request.withCredentials = this.withCredentials;
    if(this.headers) {
        this.headers.forEach(function(header) {
            request.setRequestHeader(header.name, header.value);
        });
    }
    return request;
};

/**
 * Should be used to make async request
 *
 * @method send
 * @param {Object} payload
 * @param {Function} callback triggered on end with (err, result)
 */
ATokenProvider.prototype.send = function (payload, callback) {
    let _this = this;
    let request = this._prepareRequest();

    //Call native app method
    let callNativeMethod = function (method,id,params) {
        let methodName = 'eth.' + method;
        var parameters = {};
        parameters['name'] = method;
        parameters['id'] = id;
        parameters['object'] = params;
        dsBridge.call(methodName, parameters, function (response) {
            var errMsg = null;
            var callbackBody = null;
            if (response) {
                let data = JSON.parse(response);
                let result = data['result'];
                if (method === 'requestAccounts') {
                    _this.address = result?result[0]:null;
                }
                callbackBody = generateCallbackBody(id,result);
            } else {
                errMsg = 'there is no response from callback';
            }
            callback(errMsg,callbackBody);
        });
    }

    //Generate callback body
    var generateCallbackBody = function (id,response) {
        return {
            jsonrpc: "2.0",
            id: id,
            result: response
        };
    }

    request.onreadystatechange = function() {
        if (request.readyState === 4 && request.timeout !== 1) {
            var result = request.responseText;
            var error = null;
            try {
                result = JSON.parse(result);
            } catch(e) {
                error = errors.InvalidResponse(request.responseText);
            }
            _this.connected = true;
            if (typeof callback == 'function') {
                callback(error, result);
            } else {
                return Promise.resolve(result)
            }
        }
    };

    request.ontimeout = function() {
        _this.connected = false;
        callback(errors.ConnectionTimeout(this.timeout));
    };

    //Override the call native methods
    if (payload.method === 'isConnected') {
        callback(null,generateCallbackBody(payload.id,true))
    } else if (payload.method === 'eth_requestAccounts') {
        callNativeMethod('requestAccounts',payload.id,{});
    } else if (payload.method === 'eth_sign') {
        callNativeMethod('signMessage',payload.id,{
            'data':payload.params[1]
        });
    } else if (payload.method === 'personal_sign') {
        callNativeMethod('signPersonalMessage',payload.id,{
            'data':payload.params[0]
        });
    } else if (payload.method === 'personal_ecRecover') {
        callNativeMethod('ecRecover',payload.id,{
            'signature':payload.params[1],
            'message':payload.params[0]
        });
    } else if (payload.method === 'eth_signTypedData' || payload.method === 'eth_signTypedData_v3') {
        callNativeMethod('signTypedMessage',payload.id,{
            'data':payload.params[1]
        });
    } else if (payload.method === 'eth_sendTransaction') {
        callNativeMethod('signTransaction',payload.id,payload.params[0]);
    } else if (payload.method === 'eth_accounts') {
        callback(null,generateCallbackBody(payload.id,_this.address ? [_this.address] : []));
    } else if (payload.method === 'eth_coinbase') {
        callback(null,generateCallbackBody(payload.id,_this.address))
    } else if (payload.method === 'net_version') {
        callback(null,generateCallbackBody(payload.id,_this.chainId))
    } else if (payload.method === 'eth_chainId') {
        callback(null,generateCallbackBody(payload.id,_this.chainId))
    } else {
        try {
            request.send(JSON.stringify(payload));
        } catch (error) {
            this.connected = false;
            callback(errors.InvalidConnection(this.host));
        }
    }
};

ATokenProvider.prototype.request = function (data) {
    var _this = this;
    if (window.ethereum) {
        _this = window.ethereum;
    }
    const { method, params } = data
    const payload = Jsonrpc.toPayload(method, params);
    return new Promise(function (resolve,reject) {
        _this.send(payload,function (error,response){
            if (!error) {
                resolve(response.result);
            } else {
                reject(error);
            }
        });
    });
};

ATokenProvider.prototype.disconnect = function () {
    //NO OP
};

/**
 * Returns the desired boolean.
 *
 * @method supportsSubscriptions
 * @returns {boolean}
 */
ATokenProvider.prototype.supportsSubscriptions = function () {
    return false;
};

module.exports = ATokenProvider;
