from django.db import models

from apps.containers.models import Container
from apps.plants.models import Plant


class GrowingTrialStatus(models.TextChoices):
    PLANNED = 'planned', 'Planned'
    ACTIVE = 'active', 'Active'
    COMPLETED = 'completed', 'Completed'
    ABANDONED = 'abandoned', 'Abandoned'


class GrowingTrialStartMethod(models.TextChoices):
    SEED = 'seed', 'Seed'
    SEEDLING_TRANSPLANT = 'seedling_transplant', 'Seedling/transplant'


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
    start_date = models.DateField(null=True, blank=True)
    start_method = models.CharField(
        max_length=20,
        choices=GrowingTrialStartMethod,
        null=True,
        blank=True,
    )
    end_date = models.DateField(null=True, blank=True)
    result_summary = models.TextField(max_length=5000, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    objects = GrowingTrialManager()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=GrowingTrialStatus.values),
                name='growing_trial_valid_status',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(start_date__isnull=True, start_method__isnull=True)
                    | models.Q(start_date__isnull=False, start_method__isnull=False)
                ),
                name='growing_trial_start_fields_together',
            ),
            models.CheckConstraint(
                condition=(
                    ~models.Q(status=GrowingTrialStatus.PLANNED)
                    | models.Q(start_date__isnull=True, start_method__isnull=True)
                ),
                name='growing_trial_planned_without_start',
            ),
            models.CheckConstraint(
                condition=(
                    ~models.Q(status=GrowingTrialStatus.ACTIVE)
                    | models.Q(start_date__isnull=False, start_method__isnull=False)
                ),
                name='growing_trial_active_has_start',
            ),
            models.CheckConstraint(
                condition=(
                    ~models.Q(status=GrowingTrialStatus.COMPLETED)
                    | models.Q(start_date__isnull=False, start_method__isnull=False)
                ),
                name='growing_trial_completed_has_start',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        status__in=[
                            GrowingTrialStatus.COMPLETED,
                            GrowingTrialStatus.ABANDONED,
                        ],
                        end_date__isnull=False,
                    )
                    | models.Q(
                        status__in=[
                            GrowingTrialStatus.PLANNED,
                            GrowingTrialStatus.ACTIVE,
                        ],
                        end_date__isnull=True,
                        result_summary='',
                    )
                ),
                name='growing_trial_terminal_fields_match_status',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(start_method__isnull=True)
                    | models.Q(start_method__in=GrowingTrialStartMethod.values)
                ),
                name='growing_trial_valid_start_method',
            ),
            models.UniqueConstraint(
                fields=['container'],
                condition=models.Q(status=GrowingTrialStatus.ACTIVE),
                name='one_active_growing_trial_per_container',
            ),
        ]

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.plant} in {self.container}'
