from mongows.mws.db import get_db
from mongows.mws.util import UseResId
from abc import ABCMeta, abstractmethod
from collections import Counter


class ValidationTest:
    __metaclass__ = ABCMeta

    def __init__(self, res_id):
        self.res_id = res_id
        self.db = get_db()

    def __hashDict(self, d):
        for key in d:
            if isinstance(d[key], dict):
                d[key] = __hashDict(d[key])
        return tuple(d.items())

    # Collection must exactly equal the data set
    def collection_equals(self, collection, data, check_id=False):
        data = (self.__hashDict(x) for x in data)
        with UseResId(self.res_id):
            projection = None if check_id else {'_id': 0}
            result = self.db[collection].find({}, projection)
            result = (self.__hashDict(x) for x in result)
            return Counter(result) == Counter(data)

    # Data must be a subset of collection
    def collection_contains(self, collection, data, check_id=False):
        with UseResId(self.res_id):
            projection = None if check_id else {'_id': 0}
            result = list(self.db[collection].find({'$or': data}, projection))
            data = Counter(self.__hashDict(x) for x in data)
            result = Counter(self.__hashDict(x) for x in result)
            return all(data[key] <= result[key] for key in data)

    # Collection must contain one or more of the elements in data
    def collection_contains_any(self, collection, data, check_id=False):
        with UseResId(self.res_id):
            projection = None if check_id else {'_id': 0}
            result = list(self.db[collection].find({'$or': data}, projection))
            data = {self.__hashDict(x) for x in data}
            result = {self.__hashDict(x) for x in result}
            return any(x in result for x in data)

    # Collection does not contain any of the elements in data
    def collection_contains_none(self, collection, data, check_id=False):
        return not self.collection_contains_any(collection, data, check_id)

    # Require all inheriting classes to implement a run method
    @abstractmethod
    def run(self):
        pass
