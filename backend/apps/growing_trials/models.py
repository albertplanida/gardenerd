from django.core.exceptions import ValidationError
from django.db import models

from apps.containers.models import Container
from apps.plants.models import Plant

GROWING_TRIAL_INITIAL_STATUS_MESSAGE = 'New Growing Trials must start as planned'


class GrowingTrialStatus(models.TextChoices):
    PLANNED = 'planned', 'Planned'


class GrowingTrial(models.Model):
    plant = models.ForeignKey(
        Plant,
        on_delete=models.PROTECT,
        related_name='growing_trials',
    )
    container = models.ForeignKey(
        Container,
        on_delete=models.PROTECT,
        related_name='growing_trials',
    )
    status = models.CharField(
        max_length=20,
        choices=GrowingTrialStatus,
        default=GrowingTrialStatus.PLANNED,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self._state.adding and self.status != GrowingTrialStatus.PLANNED:
            raise ValidationError({'status': GROWING_TRIAL_INITIAL_STATUS_MESSAGE})

        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.plant} in {self.container}'
