mongoDB Web Shell REST API
==========================
__Note__: The initial path component and resource name, "mws", short for "mongo
web shell", is subject to change.

* `POST mws` :: Creates a new mws resource that represents a mongoDB database
  and returns the associated URI. A user can make requests to the returned URI
  (see the API below) to interact with the backing mongo instance.

  Creating a mws resource involves copying an initial mongoDB database data
  set.
    * __Params__: N/A
    * __Returns__:
        * *res_id*: The id of the new resource. It should be used when making
        queries to the resource.
    * __TODO__:
        * Spec out what else goes into creating a new mws resource.
        * A user must be authenticated to ensure only the creator of the mws
          resource can access it (probably done through cookies). Spec out this
          behavior.
        * Eventually, the mws resource will be able to be copied from several
          initial data sets that are specified in the configuration file; there
          should be a parameter in the request to specify which data set to
          copy.

* `POST mws/:res_id/keep-alive` :: Resets the mws resource's timeout period at
  the given id.
    * __Params__:
        * *:res_id*: The id of the desired mws resource.
    * __Returns__: N/A

db.collection
-------------
* `GET mws/:res_id/db/:collection_name/find` ::
  [`db.collection.find(query, projection)`][.find()] ::
  Performs a find() on the mws resource at the given id and returns a status
  code, the result of the query if successful or an error string if query is
  unsuccessful.
    * __Params__:
        * *:res_id*: The id of the desired mws resource.
        * *:collection_name*: The mongo "collection" on which to run the query.
        * *db*: The mongo "database" on which to run the query.
        * *query*: (Optional) Specifies the selection criteria using
        [query operators][].
        * *projection*: (Optional) Controls the fields to return, or the
        projection.
    * __Returns__:
        * *status_code*: The code describing the status of the given query.
        * *result*: The result of running the given query on the specified mws
          resource if successful, otherwise an error message.
    * __TODO__:
        * Specify which error codes are returned, particularly which are
          success and which are failure.
        * Split result into result and error?
        * Should we return a cursor like the mongo js api does?
        * Provide linked "projection" resources.

* `POST mws/:res_id/db/:collection_name/insert` ::
  [`db.collection.insert(document)`][.insert()] ::
  Inserts the specified document into the mws resource at the given id and
  returns a status code, and an error string if the insertion is unsuccessful.
    * __Params__:
        * *:res_id*: The id of the desired mws resource.
        * *:collection_name*: The mongo "collection" in which to insert the
        document.
        * *db*: The mongo "database" in which to insert the document.
        * *document*: A mongo "document" to insert into the collection.
    * __Returns__:
        * *status_code*: The code describing the status of the given insertion.
        * *result*: An error string if the insertion is unsuccessful.
    * __TODO__:
        * Move repetition from find() into a generic section under 'Queries'.
        * Provide linked "document" resources.

* `GET / POST /mws/<res_id>/<error_type>` :: a method to redirect to to generate
  error messages
    *__Params__:
      * *res_id*: The id of the requesting client
      * *error_type*: The type of error (may change to a code)
      *__Returns__: Error code

TODO
----
* Add types to params/return values?

[.find()]: http://docs.mongodb.org/manual/reference/method/db.collection.find/
[.insert()]: http://docs.mongodb.org/manual/reference/method/db.collection.insert/

[query operators]: http://docs.mongodb.org/manual/reference/operators/
