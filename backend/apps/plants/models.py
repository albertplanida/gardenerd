from django.core.exceptions import ValidationError
from django.db import models

PLANT_NAME_MAX_LENGTH = 255
PLANT_CARE_NOTES_MAX_LENGTH = 5000

PLANT_NAME_REQUIRED_MESSAGE = 'Plant name is required'
PLANT_NAME_MAX_LENGTH_MESSAGE = (
    f'Plant name must be {PLANT_NAME_MAX_LENGTH} characters or fewer'
)
PLANT_CARE_NOTES_MAX_LENGTH_MESSAGE = (
    f'Plant care notes must be {PLANT_CARE_NOTES_MAX_LENGTH} characters or fewer'
)


class Plant(models.Model):
    name = models.CharField(max_length=PLANT_NAME_MAX_LENGTH)
    care_notes = models.TextField(blank=True, max_length=PLANT_CARE_NOTES_MAX_LENGTH)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def _normalize_fields(self):
        self.name = self.name.strip()
        self.care_notes = self.care_notes.strip()

    def clean(self):
        super().clean()

        self._normalize_fields()

        errors = {}

        if not self.name:
            errors['name'] = PLANT_NAME_REQUIRED_MESSAGE
        elif len(self.name) > PLANT_NAME_MAX_LENGTH:
            errors['name'] = PLANT_NAME_MAX_LENGTH_MESSAGE

        if len(self.care_notes) > PLANT_CARE_NOTES_MAX_LENGTH:
            errors['care_notes'] = PLANT_CARE_NOTES_MAX_LENGTH_MESSAGE

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self._normalize_fields()
        self.full_clean()

        update_fields = kwargs.get('update_fields')
        if update_fields is not None:
            kwargs['update_fields'] = set(update_fields) | {'name', 'care_notes'}

        return super().save(*args, **kwargs)

    def __str__(self):
        return self.name
