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
    var params = {
      query: args.query,
      projection: args.projection
    };
    mongo.util.pruneKeys(params, ['query', 'projection']);
    // For a GET request, jQuery divides each key in a JSON object into params
    // (i.e. var obj = {one: 1, two: 2} => ?obj[one]=1&obj[two]=2 ), which is
    // harder to reconstruct on the backend than just stringifying the values
    // individually, which is what we do here.
    mongo.util.stringifyKeys(params);

    console.debug('find() request:', url, params);
    $.ajax({
      async: async,
      url: url,
      data: params,
      dataType: 'json',
      success: function (data, textStatus, jqXHR) {
        // TODO: This status code is undocumented.
        if (data.status === 0) {
          console.debug('dbCollectionFind success');
          cursor._storeQueryResult(data.result);
          onSuccess();
        } else {
          cursor._shell.insertResponseLine('ERROR: server error occured');
          console.debug('dbCollectionFind error:', data.result);
        }
      }
    }).fail(function (jqXHR, textStatus, errorThrown) {
      cursor._shell.insertResponseLine('ERROR: server error occured');
      console.error('dbCollectionFind fail:', textStatus, errorThrown);
      // TODO: Make this more robust (currently prints two errors, eval doesn't
      // say why it failed, etc.).
      // TODO: Should we throw in insert too?
      // Throwing here will cause the query eval() to fail if not async, rather
      // than handling the edge cases in each query method individually.
      throw 'dbCollectionFind: Server error';
    });
  }

  function dbCollectionInsert(query, document_) {
    var resID = query.shell.mwsResourceID;
    var url = mongo.util.getDBCollectionResURL(resID, query.collection) +
        'insert';
    var params = {
      document: document_
    };

    console.debug('insert() request:', url, params);
    $.ajax({
      type: 'POST',
      url: url,
      data: JSON.stringify(params),
      dataType: 'json',
      contentType: 'application/json',
      success: function (data, textStatus, jqXHR) {
        // TODO: This code is undocumented.
        if (data.status === 0) {
          console.info('Insertion successful:', data);
        } else {
          // TODO: Alert the user.
          console.debug('dbCollectionInsert error', data.result);
        }
      }
    }).fail(function (jqXHR, textStatus, errorThrown) {
      query.shell.insertResponseLine('ERROR: server error occured');
      console.error('dbCollectionInsert fail:', textStatus, errorThrown);
    });
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

    console.debug('remove() request:', url, constraint, justOne);
    $.ajax({
      type: 'DELETE',
      url: url,
      data: JSON.stringify(params),
      dataType: 'json',
      contentType: 'application/json',
      success: function (data, textStatus, jqXHR) {
        // TODO: This status code is undocumented.
        if (data.status === 0) {
          console.debug('dbCollectionRemove success');
        } else {
          query.shell.insertResponseLine('ERROR: server error occured');
          console.debug('dbCollectionRemove error:', data.result);
        }
      }
    }).fail(function (jqXHR, textStatus, errorThrown) {
      query.shell.insertResponseLine('ERROR: server error occured');
      console.error('dbCollectionRemove fail:', textStatus, errorThrown);
      throw 'dbCollectionRemove: Server error';
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
    keepAlive: keepAlive
  };
}());
