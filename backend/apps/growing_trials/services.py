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
GROWING_TRIAL_NOT_ACTIVE = 'GROWING_TRIAL_NOT_ACTIVE'
GROWING_TRIAL_NOT_ENDABLE = 'GROWING_TRIAL_NOT_ENDABLE'
GROWING_TRIAL_NOT_TERMINAL = 'GROWING_TRIAL_NOT_TERMINAL'
START_DATE_IN_FUTURE = 'START_DATE_IN_FUTURE'
END_DATE_IN_FUTURE = 'END_DATE_IN_FUTURE'
END_DATE_BEFORE_START = 'END_DATE_BEFORE_START'
INVALID_RESULT_SUMMARY = 'INVALID_RESULT_SUMMARY'
CONTAINER_OCCUPIED = 'CONTAINER_OCCUPIED'
INVALID_TIME_ZONE = 'INVALID_TIME_ZONE'
END_DATE_BEFORE_LATEST_JOURNAL_EVENT = 'END_DATE_BEFORE_LATEST_JOURNAL_EVENT'

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


def _browser_time_zone(time_zone: str) -> ZoneInfo:
    try:
        return ZoneInfo(time_zone)
    except (TypeError, ValueError, ZoneInfoNotFoundError) as exc:
        raise _error(
            INVALID_TIME_ZONE,
            'Browser time zone is invalid; refresh and try again.',
        ) from exc


def _normalized_result_summary(result_summary: str | None) -> str:
    if result_summary is None:
        return ''
    if not isinstance(result_summary, str):
        raise _error(
            INVALID_RESULT_SUMMARY,
            'Result summary must be text.',
        )

    normalized = result_summary.strip()
    if len(normalized) > 5000:
        raise _error(
            INVALID_RESULT_SUMMARY,
            'Result summary cannot exceed 5,000 characters.',
        )
    return normalized


def _locked_trial(trial_id: object) -> GrowingTrial:
    try:
        # All lifecycle services lock GrowingTrial first, then Container.
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

    Container.objects.select_for_update().get(pk=trial.container_id)
    return trial


def _validate_end_date(
    trial: GrowingTrial,
    end_date: date,
    browser_time_zone: ZoneInfo,
) -> None:
    if end_date > timezone.now().astimezone(browser_time_zone).date():
        raise _error(END_DATE_IN_FUTURE, 'End date cannot be in the future.')
    if trial.start_date is not None and end_date < trial.start_date:
        raise _error(
            END_DATE_BEFORE_START,
            'End date cannot be before the start date.',
        )
    latest_event_date = (
        trial.journal_events.order_by('-event_date')
        .values_list('event_date', flat=True)
        .first()
    )
    if latest_event_date is not None and end_date < latest_event_date:
        raise _error(
            END_DATE_BEFORE_LATEST_JOURNAL_EVENT,
            'End date cannot be before the latest Journal Event.',
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

    browser_time_zone = _browser_time_zone(time_zone)

    if start_date > timezone.now().astimezone(browser_time_zone).date():
        raise _error(START_DATE_IN_FUTURE, 'Start date cannot be in the future.')

    try:
        with transaction.atomic():
            trial = _locked_trial(trial_id)

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


def complete_growing_trial(
    *,
    trial_id: object,
    end_date: date,
    result_summary: str | None,
    time_zone: str,
) -> GrowingTrial:
    return _end_growing_trial(
        trial_id=trial_id,
        end_date=end_date,
        result_summary=result_summary,
        time_zone=time_zone,
        target_status=GrowingTrialStatus.COMPLETED,
        allowed_statuses=[GrowingTrialStatus.ACTIVE],
        invalid_state_code=GROWING_TRIAL_NOT_ACTIVE,
        invalid_state_message='Only active Growing Trials can be completed.',
    )


def abandon_growing_trial(
    *,
    trial_id: object,
    end_date: date,
    result_summary: str | None,
    time_zone: str,
) -> GrowingTrial:
    return _end_growing_trial(
        trial_id=trial_id,
        end_date=end_date,
        result_summary=result_summary,
        time_zone=time_zone,
        target_status=GrowingTrialStatus.ABANDONED,
        allowed_statuses=[GrowingTrialStatus.PLANNED, GrowingTrialStatus.ACTIVE],
        invalid_state_code=GROWING_TRIAL_NOT_ENDABLE,
        invalid_state_message='Only planned or active Growing Trials can be abandoned.',
    )


def _end_growing_trial(
    *,
    trial_id: object,
    end_date: date,
    result_summary: str | None,
    time_zone: str,
    target_status: GrowingTrialStatus,
    allowed_statuses: list[GrowingTrialStatus],
    invalid_state_code: str,
    invalid_state_message: str,
) -> GrowingTrial:
    browser_time_zone = _browser_time_zone(time_zone)
    normalized_summary = _normalized_result_summary(result_summary)

    with transaction.atomic():
        trial = _locked_trial(trial_id)
        if trial.status not in allowed_statuses:
            raise _error(invalid_state_code, invalid_state_message)

        _validate_end_date(trial, end_date, browser_time_zone)
        trial.status = target_status
        trial.end_date = end_date
        trial.result_summary = normalized_summary
        trial.save(update_fields=['status', 'end_date', 'result_summary', 'updated_at'])

    trial.refresh_from_db()
    return trial


def update_growing_trial_result(
    *,
    trial_id: object,
    end_date: date,
    result_summary: str | None,
    time_zone: str,
) -> GrowingTrial:
    browser_time_zone = _browser_time_zone(time_zone)
    normalized_summary = _normalized_result_summary(result_summary)

    with transaction.atomic():
        trial = _locked_trial(trial_id)
        if trial.status not in [
            GrowingTrialStatus.COMPLETED,
            GrowingTrialStatus.ABANDONED,
        ]:
            raise _error(
                GROWING_TRIAL_NOT_TERMINAL,
                'Only completed or abandoned Growing Trials can be edited.',
            )

        _validate_end_date(trial, end_date, browser_time_zone)
        trial.end_date = end_date
        trial.result_summary = normalized_summary
        trial.save(update_fields=['end_date', 'result_summary', 'updated_at'])

    trial.refresh_from_db()
    return trial
