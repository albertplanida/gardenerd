from django.db import models

from apps.containers.models import Container
from apps.plants.models import Plant


class GrowingTrialStatus(models.TextChoices):
    PLANNED = 'planned', 'Planned'


class GrowingTrialManager(models.Manager):
    def create_planned(self, plant: Plant, container: Container):
        trial = self.model(
            plant=plant,
            container=container,
            status=GrowingTrialStatus.PLANNED,
        )
        trial.save(using=self._db)
        return trial


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
    objects = GrowingTrialManager()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=GrowingTrialStatus.values),
                name='growing_trial_valid_status',
            ),
        ]

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.plant} in {self.container}'
