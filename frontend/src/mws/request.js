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

  /**
   * Makes a find request to the mongod instance on the backing server. On
   * success, the result is stored and onSuccess is called, otherwise a failure
   * message is printed and an error is thrown. The request is optionally
   * async, as determined by the given parameter, as some functions (e.g.
   * cursor.next()) need to return a value from the request directly into eval.
   */
  function dbCollectionFind(cursor, onSuccess, async) {
    var resID = cursor._shell.mwsResourceID;
    var args = cursor._query.args;

    var url = mongo.util.getDBCollectionResURL(resID, cursor._collection) +
        'find';
    var params = {query: args.query, projection: args.projection};

    var success = function (data) {
      cursor._storeQueryResult(data.result);
      onSuccess(data);
    };
    mongo.request.__makeRequest(url, params, 'GET', 'dbCollectionFind', cursor._shell,
      success, async);
  }

  function dbCollectionInsert(query, document_) {
    var resID = query.shell.mwsResourceID;
    var url = mongo.util.getDBCollectionResURL(resID, query.collection) +
        'insert';
    var params = {document: document_};
    mongo.request.__makeRequest(url, params, 'POST', 'dbCollectionInsert', query.shell);
  }

  /**
   * Makes a remove request to the mongod instance on the backing server. On
   * success, the item(s) are removed from the collection, otherwise a failure
   * message is printed and an error is thrown.
   */
  function dbCollectionRemove(query, constraint, justOne) {
    var url = mongo.util.getDBCollectionResURL(query.shell.mwsResourceID,
                                               query.collection) + 'remove';
    var params = {constraint: constraint, just_one: justOne};
    mongo.request.__makeRequest(url, params, 'DELETE', 'dbCollectionRemove', query.shell);
  }

  /**
   * Makes an update request to the mongod instance on the backing server. On
   * success, the item(s) are updated in the collection, otherwise a failure
   * message is printed and an error is thrown.
   *
   * Optionally, an object which specifies whether to perform an upsert and/or
   * a multiple update may be used instead of the individual upsert and multi
   * parameters.
   *
   */
  function dbCollectionUpdate(query, constraint, update, upsert, multi) {
    var url = mongo.util.getDBCollectionResURL(query.shell.mwsResourceID,
                                               query.collection) + 'update';
    // handle options document for 2.2+
    if (typeof upsert === 'object'){
      if (multi !== undefined){
        var msg = 'Fourth argument must be empty when specifying upsert and multi with an object';
        query.shell.insertResponseLine('ERROR: ' + msg);
        console.error('dbCollectionUpdate fail: ' + msg);
        throw {message: 'dbCollectionUpdate: Syntax error'};
      }
      multi = upsert.multi;
      upsert = upsert.upsert;
    }

    var params = {query: constraint, update: update, upsert: !!upsert, multi: !!multi};
    mongo.request.__makeRequest(url, params, 'PUT', 'dbCollectionUpdate', query.shell);
  }

  /**
   * Makes a drop request to the mongod instance on the backing server. On
   * success, the collection is dropped from the database, otherwise a failure
   * message is printed and an error is thrown.
   *
   */
  function dbCollectionDrop(query) {
    var url = mongo.util.getDBCollectionResURL(query.shell.mwsResourceID,
                                               query.collection) + 'drop';

    mongo.request.__makeRequest(url, null, 'DELETE', 'dbCollectionDrop', query.shell);
  }

  function dbGetCollectionNames(shell, callback){
    var url = mongo.util.getDBResURL(shell.mwsResourceID) + 'getCollectionNames';

    mongo.request.__makeRequest(url, undefined, 'GET', 'getCollectionNames', shell, callback);
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
    dbCollectionFind: dbCollectionFind,
    dbCollectionInsert: dbCollectionInsert,
    dbCollectionRemove: dbCollectionRemove,
    dbCollectionUpdate: dbCollectionUpdate,
    dbCollectionDrop: dbCollectionDrop,
    dbGetCollectionNames: dbGetCollectionNames,
    keepAlive: keepAlive,
    __makeRequest: makeRequest
  };
}());
