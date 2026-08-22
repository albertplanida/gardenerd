from django.core.exceptions import ValidationError
from django.db import models

from apps.growing_trials.models import GrowingTrial

JOURNAL_NOTE_MAX_LENGTH = 5000
INVALID_JOURNAL_NOTE_MESSAGE = 'Note is required and cannot exceed 5,000 characters.'


class JournalEventEventType(models.TextChoices):
    PLANTED = 'planted', 'Planted'
    WATERED = 'watered', 'Watered'
    GERMINATED = 'germinated', 'Germinated'
    FERTILIZED = 'fertilized', 'Fertilized'
    PRUNED = 'pruned', 'Pruned'
    HARVESTED = 'harvested', 'Harvested'
    PROBLEM_NOTICED = 'problem_noticed', 'Problem noticed'
    PHOTO_TAKEN = 'photo_taken', 'Photo taken'
    GENERAL_OBSERVATION = 'general_observation', 'General observation'


class JournalEvent(models.Model):
    growing_trial = models.ForeignKey(
        GrowingTrial,
        on_delete=models.CASCADE,
        related_name='journal_events',
    )
    event_type = models.CharField(max_length=20, choices=JournalEventEventType)
    event_date = models.DateField()
    note = models.TextField(max_length=JOURNAL_NOTE_MAX_LENGTH)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(event_type__in=JournalEventEventType.values),
                name='journal_event_valid_event_type',
            ),
        ]
        indexes = [
            models.Index(
                fields=['growing_trial', '-event_date', '-created_at', '-id'],
                name='journal_event_timeline_idx',
            ),
        ]

    def clean(self):
        super().clean()
        if not isinstance(self.note, str):
            raise ValidationError({'note': INVALID_JOURNAL_NOTE_MESSAGE})
        self.note = self.note.strip()
        if not self.note or len(self.note) > JOURNAL_NOTE_MAX_LENGTH:
            raise ValidationError({'note': INVALID_JOURNAL_NOTE_MESSAGE})

    def save(self, *args, **kwargs):
        # JournalEvent.clean() owns note coercion, normalization, and validation.
        self.full_clean(exclude={'note'})
        return super().save(*args, **kwargs)


class JournalPhoto(models.Model):
    journal_event = models.ForeignKey(
        JournalEvent,
        on_delete=models.CASCADE,
        related_name='photos',
    )
    full_object_key = models.CharField(max_length=500)
    thumbnail_object_key = models.CharField(max_length=500)
    original_filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=20)
    file_size = models.PositiveBigIntegerField()
    original_upload_size = models.PositiveBigIntegerField()
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    position = models.PositiveIntegerField()
    client_upload_id = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['position', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['journal_event', 'client_upload_id'],
                name='journal_photo_event_client_upload_unique',
            ),
            models.UniqueConstraint(
                fields=['journal_event', 'position'],
                name='journal_photo_event_position_unique',
            ),
            models.CheckConstraint(
                condition=models.Q(position__gte=0),
                name='journal_photo_position_nonnegative',
            ),
        ]
