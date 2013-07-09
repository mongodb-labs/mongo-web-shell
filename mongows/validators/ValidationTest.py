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

    def __precompute(self, collection, data_only, data, check_id):
        with UseResId(self.res_id):
            query = {'$or': data} if data_only else {}
            projection = None if check_id else {'_id': 0}
            result = self.db[collection].find(query, projection)
            data = (self.__hashDict(x) for x in data)
            result = (self.__hashDict(x) for x in result)
            return data, result

    # Collection must exactly equal the data set
    def collection_equals(self, collection, data, check_id=False):
        data, result = self.__precompute(collection, False, data, check_id)
        return Counter(result) == Counter(data)

    # Data must be a subset of collection
    def collection_contains(self, collection, data, check_id=False):
        data, result = self.__precompute(collection, True, data, check_id)
        data = Counter(data)
        result = Counter(result)
        return all(data[key] <= result[key] for key in data)

    # Collection must contain one or more of the elements in data
    def collection_contains_any(self, collection, data, check_id=False):
        data, result = self.__precompute(collection, True, data, check_id)
        data = set(data)
        result = set(result)
        return any(x in result for x in data)

    # Collection does not contain any of the elements in data
    def collection_contains_none(self, collection, data, check_id=False):
        data, result = self.__precompute(collection, True, data, check_id)
        data = set(data)
        result = set(result)
        return all(x not in result for x in data)

    # Require all inheriting classes to implement a run method
    @abstractmethod
    def run(self):
        pass
