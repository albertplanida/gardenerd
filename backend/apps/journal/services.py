from datetime import date
from zoneinfo import ZoneInfo

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.growing_trials.models import GrowingTrial, GrowingTrialStatus
from apps.journal.models import (
    INVALID_JOURNAL_NOTE_MESSAGE,
    JournalEvent,
    JournalEventEventType,
)
from apps.time_zones import InvalidBrowserTimeZone, parse_browser_time_zone

GROWING_TRIAL_NOT_FOUND = 'GROWING_TRIAL_NOT_FOUND'
GROWING_TRIAL_NOT_ACTIVE = 'GROWING_TRIAL_NOT_ACTIVE'
JOURNAL_EVENT_NOT_FOUND = 'JOURNAL_EVENT_NOT_FOUND'
EVENT_DATE_BEFORE_TRIAL_START = 'EVENT_DATE_BEFORE_TRIAL_START'
EVENT_DATE_IN_FUTURE = 'EVENT_DATE_IN_FUTURE'
INVALID_JOURNAL_NOTE = 'INVALID_JOURNAL_NOTE'
INVALID_TIME_ZONE = 'INVALID_TIME_ZONE'


class JournalEventError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


def _error(code: str, message: str) -> JournalEventError:
    return JournalEventError(code, message)


def _browser_time_zone(time_zone: str) -> ZoneInfo:
    try:
        return parse_browser_time_zone(time_zone)
    except InvalidBrowserTimeZone as exc:
        raise _error(
            INVALID_TIME_ZONE,
            'Browser time zone is invalid; refresh and try again.',
        ) from exc


def _save_event(event: JournalEvent, **kwargs) -> None:
    try:
        event.save(**kwargs)
    except ValidationError as exc:
        if set(getattr(exc, 'error_dict', {})) == {'note'}:
            raise _error(INVALID_JOURNAL_NOTE, INVALID_JOURNAL_NOTE_MESSAGE) from exc
        raise


def _locked_trial(trial_id: object) -> GrowingTrial:
    try:
        return GrowingTrial.objects.select_for_update().get(pk=trial_id)
    except (
        GrowingTrial.DoesNotExist,
        TypeError,
        ValueError,
        ValidationError,
    ) as exc:
        raise _error(GROWING_TRIAL_NOT_FOUND, 'Growing Trial not found.') from exc


def _event_trial_id(event_id: object) -> int:
    try:
        return JournalEvent.objects.values_list('growing_trial_id', flat=True).get(
            pk=event_id
        )
    except (
        JournalEvent.DoesNotExist,
        TypeError,
        ValueError,
        ValidationError,
    ) as exc:
        raise _error(JOURNAL_EVENT_NOT_FOUND, 'Journal Event not found.') from exc


def _locked_event(event_id: object) -> JournalEvent:
    try:
        return JournalEvent.objects.select_for_update().get(pk=event_id)
    except JournalEvent.DoesNotExist as exc:
        raise _error(JOURNAL_EVENT_NOT_FOUND, 'Journal Event not found.') from exc


def _validate_active(trial: GrowingTrial) -> None:
    if trial.status != GrowingTrialStatus.ACTIVE:
        raise _error(
            GROWING_TRIAL_NOT_ACTIVE,
            'Journal Events can only be changed for active Growing Trials.',
        )


def _validate_event_date(
    trial: GrowingTrial,
    event_date: date,
    browser_time_zone: ZoneInfo,
) -> None:
    if trial.start_date is not None and event_date < trial.start_date:
        raise _error(
            EVENT_DATE_BEFORE_TRIAL_START,
            'Event date cannot be before the Growing Trial start date.',
        )
    if event_date > timezone.now().astimezone(browser_time_zone).date():
        raise _error(EVENT_DATE_IN_FUTURE, 'Event date cannot be in the future.')


def create_journal_event(
    *,
    trial_id: object,
    event_type: JournalEventEventType,
    event_date: date,
    note: str,
    time_zone: str,
) -> JournalEvent:
    browser_time_zone = _browser_time_zone(time_zone)

    with transaction.atomic():
        trial = _locked_trial(trial_id)
        _validate_active(trial)
        _validate_event_date(trial, event_date, browser_time_zone)
        event = JournalEvent(
            growing_trial=trial,
            event_type=event_type,
            event_date=event_date,
            note=note,
        )
        _save_event(event)

    return event


def update_journal_event(
    *,
    event_id: object,
    event_type: JournalEventEventType,
    event_date: date,
    note: str,
    time_zone: str,
) -> JournalEvent:
    trial_id = _event_trial_id(event_id)
    browser_time_zone = _browser_time_zone(time_zone)

    with transaction.atomic():
        trial = _locked_trial(trial_id)
        event = _locked_event(event_id)
        _validate_active(trial)
        _validate_event_date(trial, event_date, browser_time_zone)
        event.event_type = event_type
        event.event_date = event_date
        event.note = note
        _save_event(
            event,
            update_fields=['event_type', 'event_date', 'note', 'updated_at'],
        )

    event.refresh_from_db()
    return event


def delete_journal_event(*, event_id: object) -> int:
    trial_id = _event_trial_id(event_id)

    with transaction.atomic():
        trial = _locked_trial(trial_id)
        event = _locked_event(event_id)
        _validate_active(trial)
        deleted_id = event.pk
        event.delete()

    return deleted_id
