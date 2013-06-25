from pymongo.database import Database


def get_internal_coll_name(res_id, collection_name):
    return '%s%s' % (res_id, collection_name)


class UseResId:
    def __init__(self, res_id):
        self.res_id = res_id

    def __enter__(self):
        self.old_get_attr = old_get_attr = Database.__getattr__
        template = str(self.res_id) + '%s'

        def __getattr__(self, item):
            return old_get_attr(self, template % item)
        Database.__getattr__ = __getattr__

    def __exit__(self, exc_type, exc_val, exc_tb):
        Database.__getattr__ = self.old_get_attr
