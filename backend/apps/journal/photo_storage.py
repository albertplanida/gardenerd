import logging

from django.core.files.storage import storages

logger = logging.getLogger(__name__)


def get_photo_storage():
    return storages['default']


def photo_url(object_key: str) -> str:
    return get_photo_storage().url(object_key)


def delete_photo_objects(object_keys: list[str], *, raise_errors: bool) -> bool:
    storage = get_photo_storage()
    deleted = True
    for object_key in object_keys:
        if not object_key:
            continue
        try:
            storage.delete(object_key)
        except Exception:
            deleted = False
            logger.exception('Failed to delete journal photo object %s', object_key)
            if raise_errors:
                raise
    return deleted
