/* jshint camelcase: false, unused: false */
/* global console, mongo */
mongo.request = (function () {
  /*
   * Creates an MWS resource on the remote server. Calls onSuccess if the data
   * received is valid. Otherwise, prints an error to the given shell.
   */
  function createMWSResource(shell, onSuccess) {
    $.post(mongo.config.baseUrl, null, function (data, textStatus, jqXHR) {
      if (!data.res_id) {
        shell.insertResponseLine('ERROR: No res_id recieved! Shell disabled.');
        console.warn('No res_id received! Shell disabled.', data);
        return;
      }
      console.info('/mws/' + data.res_id, 'was created succssfully.');
      onSuccess(data);
    },'json').fail(function (jqXHR, textStatus, errorThrown) {
      shell.insertResponseLine('Failed to create resources on DB on server');
      console.error('AJAX request failed:', textStatus, errorThrown);
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
          onSuccess(data.result);
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

  function keepAlive(shell) {
    var url = mongo.config.baseUrl + shell.mwsResourceID + '/keep-alive';
    $.post(url, null, function (data, textStatus, jqXHR) {
        console.info('Keep-alive succesful');
      }).fail(function (jqXHR, textStatus, errorThrown) {
        console.err('ERROR: keep alive failed: ' + errorThrown +
            ' STATUS: ' + textStatus);
      });
  }

  return {
    createMWSResource: createMWSResource,
    keepAlive: keepAlive,
    makeRequest: makeRequest
  };
}());
