import os
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta
from threading import Barrier

import pytest
from django.core.exceptions import ValidationError
from django.db import connection, connections

from apps.containers.models import Container
from apps.growing_trials.models import (
    GrowingTrial,
    GrowingTrialStartMethod,
    GrowingTrialStatus,
)
from apps.growing_trials.services import (
    END_DATE_BEFORE_LATEST_JOURNAL_EVENT,
    END_DATE_BEFORE_START,
    GrowingTrialTransitionError,
    abandon_growing_trial,
    complete_growing_trial,
    update_growing_trial_result,
)
from apps.journal.models import JournalEvent, JournalEventEventType
from apps.journal.services import (
    EVENT_DATE_BEFORE_TRIAL_START,
    EVENT_DATE_IN_FUTURE,
    GROWING_TRIAL_NOT_ACTIVE,
    GROWING_TRIAL_NOT_FOUND,
    INVALID_JOURNAL_NOTE,
    INVALID_TIME_ZONE,
    JOURNAL_EVENT_NOT_FOUND,
    JournalEventError,
    create_journal_event,
    delete_journal_event,
    update_journal_event,
)
from apps.plants.models import Plant


@pytest.fixture
def active_trial():
    return GrowingTrial.objects.create(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot 1'),
        status=GrowingTrialStatus.ACTIVE,
        start_date=date.today() - timedelta(days=2),
        start_method=GrowingTrialStartMethod.SEED,
    )


def _create(trial, **overrides):
    values = {
        'trial_id': trial.pk,
        'event_type': JournalEventEventType.WATERED,
        'event_date': date.today() - timedelta(days=1),
        'note': '  First line\nSecond line  ',
        'time_zone': 'UTC',
    }
    values.update(overrides)
    return create_journal_event(**values)


def _update(event, **overrides):
    values = {
        'event_id': event.pk,
        'event_type': JournalEventEventType.PRUNED,
        'event_date': date.today(),
        'note': '  Updated  ',
        'time_zone': 'UTC',
    }
    values.update(overrides)
    return update_journal_event(**values)


def _require_postgresql():
    if connection.vendor == 'postgresql':
        return
    if os.environ.get('REQUIRE_POSTGRES') == '1':
        pytest.fail(f'PostgreSQL required, connected to {connection.vendor}')
    pytest.skip('PostgreSQL row-lock behavior only')


@pytest.mark.django_db
def test_create_update_and_delete_journal_event(active_trial):
    event = _create(active_trial)
    original_updated_at = event.updated_at

    assert event.note == 'First line\nSecond line'
    updated = _update(event)
    assert updated.growing_trial_id == active_trial.pk
    assert updated.event_type == JournalEventEventType.PRUNED
    assert updated.note == 'Updated'
    assert updated.updated_at > original_updated_at
    assert delete_journal_event(event_id=event.pk) == event.pk
    assert not JournalEvent.objects.filter(pk=event.pk).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    'status',
    [
        GrowingTrialStatus.PLANNED,
        GrowingTrialStatus.COMPLETED,
        GrowingTrialStatus.ABANDONED,
    ],
)
@pytest.mark.parametrize('operation', ['create', 'update', 'delete'])
def test_journal_mutations_reject_non_active_trials(active_trial, status, operation):
    event = _create(active_trial)
    changes = {'status': status}
    if status == GrowingTrialStatus.PLANNED:
        changes.update(start_date=None, start_method=None)
    if status in [GrowingTrialStatus.COMPLETED, GrowingTrialStatus.ABANDONED]:
        changes['end_date'] = date.today()
    GrowingTrial.objects.filter(pk=active_trial.pk).update(**changes)

    with pytest.raises(JournalEventError) as error:
        if operation == 'create':
            _create(active_trial)
        elif operation == 'update':
            _update(event)
        else:
            delete_journal_event(event_id=event.pk)

    assert error.value.code == GROWING_TRIAL_NOT_ACTIVE
    assert JournalEvent.objects.filter(pk=event.pk).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('operation', 'overrides', 'code'),
    [
        ('create', {'trial_id': 'missing'}, GROWING_TRIAL_NOT_FOUND),
        ('create', {'note': '  '}, INVALID_JOURNAL_NOTE),
        ('create', {'note': 'x' * 5001}, INVALID_JOURNAL_NOTE),
        ('create', {'time_zone': 'Invalid/Zone'}, INVALID_TIME_ZONE),
        (
            'create',
            {'event_date': date.today() - timedelta(days=3)},
            EVENT_DATE_BEFORE_TRIAL_START,
        ),
        (
            'create',
            {'event_date': date.today() + timedelta(days=1)},
            EVENT_DATE_IN_FUTURE,
        ),
        ('update', {'event_id': 'missing'}, JOURNAL_EVENT_NOT_FOUND),
        ('delete', {'event_id': 'missing'}, JOURNAL_EVENT_NOT_FOUND),
    ],
)
def test_journal_mutations_return_stable_errors_without_changes(
    active_trial, operation, overrides, code
):
    event = _create(active_trial)
    original = (event.event_type, event.event_date, event.note)

    with pytest.raises(JournalEventError) as error:
        if operation == 'create':
            _create(active_trial, **overrides)
        elif operation == 'update':
            _update(event, **overrides)
        else:
            delete_journal_event(**overrides)

    assert error.value.code == code
    event.refresh_from_db()
    assert (event.event_type, event.event_date, event.note) == original


@pytest.mark.django_db
@pytest.mark.parametrize('operation', ['create', 'update'])
@pytest.mark.parametrize('note', ['', ' \n\t ', 'x' * 5001, None, 123])
def test_services_translate_every_invalid_note_shape(active_trial, operation, note):
    event = _create(active_trial)
    original = (event.event_type, event.event_date, event.note)

    with pytest.raises(JournalEventError) as error:
        if operation == 'create':
            _create(active_trial, note=note)
        else:
            _update(event, note=note)

    assert error.value.code == INVALID_JOURNAL_NOTE
    assert str(error.value) == 'Note is required and cannot exceed 5,000 characters.'
    assert JournalEvent.objects.count() == 1
    event.refresh_from_db()
    assert (event.event_type, event.event_date, event.note) == original


@pytest.mark.django_db
def test_service_does_not_translate_unrelated_model_validation(
    active_trial, monkeypatch
):
    def invalid_event_date(self):
        raise ValidationError({'event_date': 'Unrelated model validation.'})

    monkeypatch.setattr(JournalEvent, 'clean', invalid_event_date)

    with pytest.raises(ValidationError) as error:
        _create(active_trial)

    assert error.value.message_dict == {'event_date': ['Unrelated model validation.']}
    assert not JournalEvent.objects.exists()


@pytest.mark.django_db
def test_event_date_uses_browser_local_today(active_trial, monkeypatch):
    utc_now = datetime(2026, 8, 15, 1, tzinfo=UTC)
    monkeypatch.setattr('apps.journal.services.timezone.now', lambda: utc_now)
    GrowingTrial.objects.filter(pk=active_trial.pk).update(start_date=date(2026, 8, 14))

    event = _create(
        active_trial,
        event_date=date(2026, 8, 14),
        time_zone='America/Los_Angeles',
    )

    assert event.event_date == date(2026, 8, 14)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('service', 'terminal_status'),
    [
        (complete_growing_trial, GrowingTrialStatus.COMPLETED),
        (abandon_growing_trial, GrowingTrialStatus.ABANDONED),
        (update_growing_trial_result, GrowingTrialStatus.COMPLETED),
    ],
)
def test_terminal_services_reject_before_latest_event_and_accept_equality(
    active_trial,
    service,
    terminal_status,
):
    _create(active_trial, event_date=date.today())
    if service is update_growing_trial_result:
        complete_growing_trial(
            trial_id=active_trial.pk,
            end_date=date.today(),
            result_summary=None,
            time_zone='UTC',
        )

    with pytest.raises(GrowingTrialTransitionError) as error:
        service(
            trial_id=active_trial.pk,
            end_date=date.today() - timedelta(days=1),
            result_summary='Rejected',
            time_zone='UTC',
        )

    assert error.value.code == END_DATE_BEFORE_LATEST_JOURNAL_EVENT
    active_trial.refresh_from_db()
    assert active_trial.status == (
        GrowingTrialStatus.COMPLETED
        if service is update_growing_trial_result
        else GrowingTrialStatus.ACTIVE
    )
    result = service(
        trial_id=active_trial.pk,
        end_date=date.today(),
        result_summary='Accepted',
        time_zone='UTC',
    )
    assert result.status == terminal_status
    assert result.end_date == date.today()
    assert result.result_summary == 'Accepted'


@pytest.mark.django_db
@pytest.mark.parametrize(
    'service',
    [
        complete_growing_trial,
        abandon_growing_trial,
        update_growing_trial_result,
    ],
)
def test_before_start_precedes_before_latest_event_for_terminal_services(
    active_trial,
    service,
):
    _create(active_trial, event_date=date.today())
    if service is update_growing_trial_result:
        complete_growing_trial(
            trial_id=active_trial.pk,
            end_date=date.today(),
            result_summary=None,
            time_zone='UTC',
        )

    with pytest.raises(GrowingTrialTransitionError) as error:
        service(
            trial_id=active_trial.pk,
            end_date=active_trial.start_date - timedelta(days=1),
            result_summary=None,
            time_zone='UTC',
        )

    assert error.value.code == END_DATE_BEFORE_START


def _active_trial_for_race():
    return GrowingTrial.objects.create(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot 1'),
        status=GrowingTrialStatus.ACTIVE,
        start_date=date.today() - timedelta(days=2),
        start_method=GrowingTrialStartMethod.SEED,
    )


@pytest.mark.django_db(transaction=True)
def test_postgresql_create_and_complete_serialize_on_conflicting_dates():
    _require_postgresql()
    trial = _active_trial_for_race()
    barrier = Barrier(2)

    def create():
        connections.close_all()
        barrier.wait()
        try:
            create_journal_event(
                trial_id=trial.pk,
                event_type=JournalEventEventType.WATERED,
                event_date=date.today(),
                note='Created',
                time_zone='UTC',
            )
            return 'created'
        except JournalEventError as error:
            return error.code
        finally:
            connections.close_all()

    def complete():
        connections.close_all()
        barrier.wait()
        try:
            complete_growing_trial(
                trial_id=trial.pk,
                end_date=date.today() - timedelta(days=1),
                result_summary=None,
                time_zone='UTC',
            )
            return 'completed'
        except GrowingTrialTransitionError as error:
            return error.code
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        create_result = executor.submit(create)
        complete_result = executor.submit(complete)

    outcome = (create_result.result(), complete_result.result())
    assert outcome in [
        ('created', END_DATE_BEFORE_LATEST_JOURNAL_EVENT),
        (GROWING_TRIAL_NOT_ACTIVE, 'completed'),
    ]
    trial.refresh_from_db()
    if outcome[0] == 'created':
        assert trial.status == GrowingTrialStatus.ACTIVE
        assert trial.end_date is None
        assert JournalEvent.objects.get().event_date == date.today()
    else:
        assert trial.status == GrowingTrialStatus.COMPLETED
        assert trial.end_date == date.today() - timedelta(days=1)
        assert not JournalEvent.objects.exists()


@pytest.mark.django_db(transaction=True)
def test_postgresql_update_and_abandon_serialize_on_conflicting_dates():
    _require_postgresql()
    trial = _active_trial_for_race()
    event = JournalEvent.objects.create(
        growing_trial=trial,
        event_type=JournalEventEventType.WATERED,
        event_date=trial.start_date,
        note='Original',
    )
    barrier = Barrier(2)

    def update():
        connections.close_all()
        barrier.wait()
        try:
            update_journal_event(
                event_id=event.pk,
                event_type=JournalEventEventType.PRUNED,
                event_date=date.today(),
                note='Updated',
                time_zone='UTC',
            )
            return 'updated'
        except JournalEventError as error:
            return error.code
        finally:
            connections.close_all()

    def abandon():
        connections.close_all()
        barrier.wait()
        try:
            abandon_growing_trial(
                trial_id=trial.pk,
                end_date=date.today() - timedelta(days=1),
                result_summary=None,
                time_zone='UTC',
            )
            return 'abandoned'
        except GrowingTrialTransitionError as error:
            return error.code
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        update_result = executor.submit(update)
        abandon_result = executor.submit(abandon)

    outcome = (update_result.result(), abandon_result.result())
    assert outcome in [
        ('updated', END_DATE_BEFORE_LATEST_JOURNAL_EVENT),
        (GROWING_TRIAL_NOT_ACTIVE, 'abandoned'),
    ]
    trial.refresh_from_db()
    event.refresh_from_db()
    if outcome[0] == 'updated':
        assert trial.status == GrowingTrialStatus.ACTIVE
        assert trial.end_date is None
        assert (event.event_type, event.event_date, event.note) == (
            JournalEventEventType.PRUNED,
            date.today(),
            'Updated',
        )
    else:
        assert trial.status == GrowingTrialStatus.ABANDONED
        assert trial.end_date == date.today() - timedelta(days=1)
        assert (event.event_type, event.event_date, event.note) == (
            JournalEventEventType.WATERED,
            trial.start_date,
            'Original',
        )


@pytest.mark.django_db(transaction=True)
def test_postgresql_delete_and_complete_serialize_on_conflicting_dates():
    _require_postgresql()
    trial = _active_trial_for_race()
    event = JournalEvent.objects.create(
        growing_trial=trial,
        event_type=JournalEventEventType.WATERED,
        event_date=date.today(),
        note='Delete me',
    )
    barrier = Barrier(2)

    def delete():
        connections.close_all()
        barrier.wait()
        try:
            delete_journal_event(event_id=event.pk)
            return 'deleted'
        finally:
            connections.close_all()

    def complete():
        connections.close_all()
        barrier.wait()
        try:
            complete_growing_trial(
                trial_id=trial.pk,
                end_date=date.today() - timedelta(days=1),
                result_summary=None,
                time_zone='UTC',
            )
            return 'completed'
        except GrowingTrialTransitionError as error:
            return error.code
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        delete_result = executor.submit(delete)
        complete_result = executor.submit(complete)

    outcome = (delete_result.result(), complete_result.result())
    assert outcome in [
        ('deleted', 'completed'),
        ('deleted', END_DATE_BEFORE_LATEST_JOURNAL_EVENT),
    ]
    trial.refresh_from_db()
    assert not JournalEvent.objects.exists()
    if outcome[1] == 'completed':
        assert trial.status == GrowingTrialStatus.COMPLETED
        assert trial.end_date == date.today() - timedelta(days=1)
    else:
        assert trial.status == GrowingTrialStatus.ACTIVE
        assert trial.end_date is None
