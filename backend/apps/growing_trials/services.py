from datetime import date
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction
from django.utils import timezone

from apps.containers.models import Container
from apps.growing_trials.models import (
    GrowingTrial,
    GrowingTrialStartMethod,
    GrowingTrialStatus,
)

GROWING_TRIAL_NOT_FOUND = 'GROWING_TRIAL_NOT_FOUND'
GROWING_TRIAL_NOT_PLANNED = 'GROWING_TRIAL_NOT_PLANNED'
START_DATE_IN_FUTURE = 'START_DATE_IN_FUTURE'
CONTAINER_OCCUPIED = 'CONTAINER_OCCUPIED'
INVALID_TIME_ZONE = 'INVALID_TIME_ZONE'

ACTIVE_CONTAINER_CONSTRAINT = 'one_active_growing_trial_per_container'


class GrowingTrialTransitionError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


def _error(code: str, message: str) -> GrowingTrialTransitionError:
    return GrowingTrialTransitionError(code, message)


def _is_active_container_violation(error: IntegrityError) -> bool:
    cause = error.__cause__
    if getattr(getattr(cause, 'diag', None), 'constraint_name', None) == (
        ACTIVE_CONTAINER_CONSTRAINT
    ):
        return True

    return connection.vendor == 'sqlite' and (
        'UNIQUE constraint failed: growing_trials_growingtrial.container_id'
        in str(error)
    )


def start_growing_trial(
    *,
    trial_id: object,
    start_date: date,
    start_method: str,
    time_zone: str,
) -> GrowingTrial:
    try:
        parsed_start_method = GrowingTrialStartMethod(start_method)
    except (TypeError, ValueError) as exc:
        raise ValueError('Unsupported Growing Trial start method') from exc

    try:
        browser_time_zone = ZoneInfo(time_zone)
    except (TypeError, ValueError, ZoneInfoNotFoundError) as exc:
        raise _error(
            INVALID_TIME_ZONE,
            'Browser time zone is invalid; refresh and try again.',
        ) from exc

    if start_date > timezone.now().astimezone(browser_time_zone).date():
        raise _error(START_DATE_IN_FUTURE, 'Start date cannot be in the future.')

    try:
        with transaction.atomic():
            try:
                # All lifecycle services lock GrowingTrial first, then Container.
                # Keep this order for future complete/abandon operations.
                trial = GrowingTrial.objects.select_for_update().get(pk=trial_id)
            except (
                GrowingTrial.DoesNotExist,
                TypeError,
                ValueError,
                ValidationError,
            ) as exc:
                raise _error(
                    GROWING_TRIAL_NOT_FOUND,
                    'Growing Trial not found.',
                ) from exc

            # Serializes starts of different planned trials in the same Container.
            Container.objects.select_for_update().get(pk=trial.container_id)

            if trial.status != GrowingTrialStatus.PLANNED:
                raise _error(
                    GROWING_TRIAL_NOT_PLANNED,
                    'Only planned Growing Trials can be started.',
                )

            if (
                GrowingTrial.objects.filter(
                    container_id=trial.container_id,
                    status=GrowingTrialStatus.ACTIVE,
                )
                .exclude(pk=trial.pk)
                .exists()
            ):
                raise _error(
                    CONTAINER_OCCUPIED,
                    'This Container already has an active Growing Trial.',
                )

            trial.status = GrowingTrialStatus.ACTIVE
            trial.start_date = start_date
            trial.start_method = parsed_start_method
            trial.save(
                update_fields=['status', 'start_date', 'start_method', 'updated_at']
            )
    except IntegrityError as exc:
        if _is_active_container_violation(exc):
            raise _error(
                CONTAINER_OCCUPIED,
                'This Container already has an active Growing Trial.',
            ) from exc
        raise

    trial.refresh_from_db()
    return trial
