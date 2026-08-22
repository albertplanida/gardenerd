from django.db import transaction
from django.db.models.signals import post_delete, pre_delete
from django.dispatch import receiver

from apps.journal.models import JournalEvent
from apps.journal.photo_storage import delete_photo_objects


@receiver(pre_delete, sender=JournalEvent)
def collect_journal_event_photo_objects(sender, instance, **kwargs):
    instance._photo_object_keys = [
        object_key
        for photo in instance.photos.all().only(
            'full_object_key', 'thumbnail_object_key'
        )
        for object_key in (photo.full_object_key, photo.thumbnail_object_key)
        if object_key
    ]


@receiver(post_delete, sender=JournalEvent)
def cleanup_journal_event_photo_objects(sender, instance, **kwargs):
    object_keys = getattr(instance, '_photo_object_keys', [])
    if object_keys:
        transaction.on_commit(
            lambda: delete_photo_objects(object_keys, raise_errors=False)
        )
