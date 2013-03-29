mongoDB Web Shell REST API
==========================
__Note__: The initial path component and resource name, "db", is subject to
change.

* `POST db` :: Creates a new db resource that represents a mongoDB database and
  returns the associated URI. A user can make requests to the returned URI (see
  the API below) to interact with the backing mongo instance.

  Creating a db resource involves copying an initial mongoDB database template.
    * __Params__: N/A
    * __Returns__:
        * *uri*: The URI to use when querying the new resource. It is of the
          form, `db/:id`.
    * __TODO__:
        * Spec out what else goes into creating a new db resource.
        * A user must be authenticated to ensure only the creator of the db
          resource can access it (probably done through cookies). Spec out this
          behavior.
        * Eventually, the db resource will be able to be copied from several
          initial templates that are specified in the configuration file; there
          should be a parameter in the request to specify which template to
          copy.

* `POST db/:id` :: Queries the db resource at the given id and returns a status
  code, the result of the query if successful or an error string if query is
  unsuccessful.
    * __Params__:
        * *id*: The id of the desired db resource.
        * *query*: The query to run on the mongodb instance.
    * __Returns__:
        * *status_code*: The code describing the status of the given query.
        * *result*: The result of running the given query on the specified db
          resource if successful, otherwise an error message.
    * __TODO__:
        * Specify which error codes are returned, particularly which are
          success and which are failure.
        * Split result into result and error?

* `PUT db/:id` :: Resets the db resource's timeout period at the given id.
    * __Params__:
        * *id*: The id of the desired db resource.
    * __Returns__: N/A
    * __TODO__:
        * `PUT` should be idempotent, however, since the timeout period will
          likely be dictated by timestamps, running `PUT` multiple times does
          not cause an identical resource state. Therefore, this functionality
          may need to be accessed by a `POST` request and thus the URI should
          change, perhaps to `db/:id/keep-alive`.

TODO
----
* Add types to params/return values?
* Is taking id as a param necessary when it is specified in the URI? Twitter
  appears to do it with their API; perhaps it is for convenience?
