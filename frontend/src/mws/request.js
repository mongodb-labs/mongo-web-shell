/*    Copyright 2013 10gen Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

/* jshint camelcase: false, unused: false */
/* global console, mongo, noty */
mongo.request = (function () {
  $.ajaxSetup({ xhrFields: {withCredentials: true}});

  /*
   * Creates an MWS resource for a set of shells on the remote server. Calls
   * onSuccess if the data received is valid. Otherwise, prints an error to the
   * given shells.
   */
  function createMWSResource(shells, onSuccess) {
    $.post(mongo.config.baseUrl, null,function (data, textStatus, jqXHR) {
      if (!data.res_id) {
        $.each(shells, function (i, shell) {
          shell.insertError('No res_id recieved! Shell disabled.');
        });
      } else {
        console.info('/mws/' + data.res_id, 'was created succssfully.');
        onSuccess(data);
      }
    }, 'json').fail(function (jqXHR, textStatus, errorThrown) {
        $.each(shells, function (i, shell) {
          shell.insertResponseLine('Failed to create resources on DB on server');
          console.error('AJAX request failed:', textStatus, errorThrown);
        });
      });
  }

  function makeRequest(url, params, type, name, shell, onSuccess, async) {
    if (async === undefined) {
      // Default async to true
      async = true;
    }
    console.debug(name + ' request:', url, params);
    $.ajax({
      async: !!async,
      type: type,
      url: url,
      data: JSON.stringify(params),
      dataType: 'json',
      contentType: 'application/json',
      success: function (data, textStatus, jqXHR) {
        console.info(name + ' success');
        if (onSuccess) {
          onSuccess(data);
        }
      },
      error: function (jqXHR, textStatus, errorThrown) {
        var response = $.parseJSON(jqXHR.responseText);
        var message = 'ERROR: ' + response.reason;
        if (response.detail) {
          message += '\n' + response.detail;
        }
        shell.insertResponseLine(message);
        console.error(name + ' fail:', textStatus, errorThrown);
        throw {};
      }
    });
  }

  function keepAlive(res_id) {
    var url = mongo.config.baseUrl + res_id + '/keep-alive';
    $.post(url, null,function (data, textStatus, jqXHR) {
      console.info('Keep-alive succesful');
      if (mongo.keepaliveNotification) {
        mongo.keepaliveNotification.setText('and we\'re back!');
        setTimeout(function () {
          mongo.keepaliveNotification.close();
        }, 1500);
      }
    }).fail(function (jqXHR, textStatus, errorThrown) {
        console.error('ERROR: keep alive failed: ' + errorThrown +
          ' STATUS: ' + textStatus);
        if (!mongo.keepaliveNotification) {
          mongo.keepaliveNotification = noty({
            layout: 'topCenter',
            type: 'warning',
            text: 'Lost connection with server\nreconnecting...',
            callback: {
              afterClose: function () {
                delete mongo.keepaliveNotification;
              }
            }
          });
        }
      });
  }

  return {
    createMWSResource: createMWSResource,
    keepAlive: keepAlive,
    makeRequest: makeRequest
  };
}());
