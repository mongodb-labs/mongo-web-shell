from mongows.mws.db import get_db
from tests import MongoWSTestCase
from mongows.validators.ValidationTest import ValidationTest


class ValidationUtilsTestCase(MongoWSTestCase):
    def setUp(self):
        class ValidationTestCase(ValidationTest):
            def run():
                pass

        self.db = get_db()
        self.validator = ValidationTestCase('test_')
        self.coll = 'test_coll'
        self.db.drop_collection(self.coll)

    def tearDown(self):
        self.db.drop_collection(self.coll)

    def test_collection_equals(self):
        self.assertTrue(self.validator.collection_equals('coll', []))
        self.assertFalse(self.validator.collection_equals('coll', [{'a': 1}]))
        for i in range(3):
            self.db.test_coll.insert({'a': i})
        self.assertTrue(self.validator.collection_equals('coll', [
            {'a': 0}, {'a': 1}, {'a': 2}]))
        self.assertFalse(self.validator.collection_equals('coll', [{'a': 1}]))

    def test_collection_contains(self):
        for i in range(3):
            self.db.test_coll.insert({'a': i})
        self.assertTrue(self.validator.collection_contains('coll',
                                                           [{'a': 0},
                                                            {'a': 1},
                                                            {'a': 2}]))
        self.assertTrue(self.validator.collection_contains('coll', [{'a': 1}]))
        self.assertFalse(self.validator.collection_contains('coll',
                                                            [{'a': 1},
                                                             {'b': 2}]))

    def test_collection_contains_any(self):
        for i in range(3):
            self.db.test_coll.insert({'a': i})
        self.assertTrue(self.validator.collection_contains_any('coll',
                                                               [{'a': 0},
                                                                {'a': 1},
                                                                {'a': 2}]))
        self.assertTrue(self.validator.collection_contains_any('coll',
                                                               [{'a': 1}]))
        self.assertTrue(self.validator.collection_contains_any('coll',
                                                               [{'a': 1},
                                                               {'b': 2}]))

    def test_collection_contains_none(self):
        for i in range(3):
            self.db.test_coll.insert({'a': i})
        self.assertTrue(self.validator.collection_contains_any('coll',
                                                               [{'a': 0},
                                                                {'a': 1},
                                                                {'a': 2}]))
        self.assertFalse(self.validator.collection_contains_none('coll',
                                                                 [{'a': 1}]))
        self.assertFalse(self.validator.collection_contains_none('coll',
                                                                 [{'a': 1},
                                                                  {'b': 2}]))
        self.assertTrue(self.validator.collection_contains_none('coll',
                                                                [{'b': 2}]))
