from django.db import models

from apps.containers.models import Container
from apps.plants.models import Plant


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

    def __str__(self):
        return f'{self.plant} in {self.container}'
