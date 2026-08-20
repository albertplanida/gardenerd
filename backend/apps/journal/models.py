from django.core.exceptions import ValidationError
from django.db import models

from apps.growing_trials.models import GrowingTrial

JOURNAL_NOTE_MAX_LENGTH = 5000


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

    def clean(self):
        super().clean()
        if not isinstance(self.note, str):
            raise ValidationError({'note': 'Note must contain 1 to 5,000 characters.'})
        self.note = self.note.strip()
        if not self.note or len(self.note) > JOURNAL_NOTE_MAX_LENGTH:
            raise ValidationError({'note': 'Note must contain 1 to 5,000 characters.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
