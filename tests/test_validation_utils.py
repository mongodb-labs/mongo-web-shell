from mongows.mws.db import get_db
from tests import MongoWSTestCase
from mongows.validators.ValidationTest import ValidationTest


class ValidationUtilsTestCase(MongoWSTestCase):
    def setUp(self):
        class ValidationTestCase(ValidationTest):
            def run(self):
                pass

        self.db = get_db()
        self.validator = ValidationTestCase('test_')
        self.coll = 'test_coll'
        self.db.drop_collection(self.coll)

    def tearDown(self):
        self.db.drop_collection(self.coll)


class CollectionEqualsUnitTest(ValidationUtilsTestCase):
    def test_equals(self):
        self.assertTrue(self.validator.collection_equals('coll', []))
        self.assertFalse(self.validator.collection_equals('coll', [{'a': 1}]))
        for i in range(3):
            self.db.test_coll.insert({'a': i})
        self.assertTrue(self.validator.collection_equals('coll', [
            {'a': 0}, {'a': 1}, {'a': 2}]))
        self.assertFalse(self.validator.collection_equals('coll', [{'a': 1}]))

    def test_equals_id(self):
        self.assertTrue(self.validator.collection_equals('coll', [], True))
        for i in range(3):
            self.db.test_coll.insert({'_id': 'id%s' % i, 'a': i})
        self.assertFalse(self.validator.collection_equals('coll', [
            {'a': 0}, {'a': 1}, {'a': 2}], True))
        self.assertTrue(self.validator.collection_equals('coll', [
            {'_id': 'id0', 'a': 0},
            {'_id': 'id1', 'a': 1},
            {'_id': 'id2', 'a': 2}], True))

    def test_recursive(self):
        data = {
            'a': {
                'b': {
                    'c': 1,
                    'd': [2, 3, 4]
                },
                'e': {'f': 'five'}
            },
            'g': 6.,
            'h': True
        }
        self.db.test_coll.insert(dict(data))  # insert modifies data, use copy
        self.assertTrue(self.validator.collection_equals('coll', [data]))

        data2 = {
            'h': True,
            'a': {
                'e': {'f': 'five'},
                'b': {
                    'd': [2, 3, 4],
                    'c': 1
                }
            },
            'g': 6.
        }

        self.assertTrue(self.validator.collection_equals('coll', [data2]))


class CollectionContainsUnitTest(ValidationUtilsTestCase):
    def test_contains(self):
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

    def test_contains_id(self):
        for i in range(3):
            self.db.test_coll.insert({'_id': 'id%s' % i, 'a': i})
        self.assertFalse(self.validator.collection_contains('coll',
                         [{'a': 1}], True))
        self.assertTrue(self.validator.collection_contains('coll', [
            {'_id': 'id1', 'a': 1}], True))
        self.assertFalse(self.validator.collection_contains('coll', [
            {'_id': 'id1', 'a': 1}, {'_id': 'id2', 'b': 2}]), True)

    def test_contains_multiple(self):
        for i in range(3):
            self.db.test_coll.insert({'a': 0})
        self.assertTrue(self.validator.collection_contains('coll',
                                                           [{'a': 0},
                                                            {'a': 0}]))
        self.assertFalse(self.validator.collection_contains('coll',
                                                            [{'a': 0},
                                                             {'a': 0},
                                                             {'a': 0},
                                                             {'a': 0}]))


class CollectionContainsAnyUnitTest(ValidationUtilsTestCase):
    def test_contains_any(self):
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

    def test_contains_any_id(self):
        for i in range(3):
            self.db.test_coll.insert({'_id': 'id%s' % i, 'a': i})
        self.assertFalse(self.validator.collection_contains_any('coll',
                         [{'a': 1}], True))
        self.assertTrue(self.validator.collection_contains_any('coll', [
            {'_id': 'id1', 'a': 1}], True))
        self.assertTrue(self.validator.collection_contains_any('coll', [
            {'_id': 'id1', 'a': 1}, {'_id': 'id2', 'b': 2}], True))


def CollectionContainsNoneUnitTest(ValidationUtilsTestCase):
    def test_contains_none(self):
        for i in range(3):
            self.db.test_coll.insert({'a': i})
        self.assertFalse(self.validator.collection_contains_none('coll',
                                                                 [{'a': 1}]))
        self.assertFalse(self.validator.collection_contains_none('coll',
                                                                 [{'a': 1},
                                                                  {'b': 2}]))
        self.assertTrue(self.validator.collection_contains_none('coll',
                                                                [{'b': 2}]))

    def test_contains_none_id(self):
        for i in range(3):
            self.db.test_coll.insert({'a': i})
        self.assertTrue(self.validator.collection_contains_none('coll',
                                                                [{'a': 1}],
                                                                True))
        self.assertFalse(self.validator.collection_contains_none('coll', [
                         {'_id': 'id1', 'a': 1}]))
        self.assertTrue(self.validator.collection_contains_none('coll',
                                                                [{'_id': 'id2',
                                                                  'b': 2}]))
