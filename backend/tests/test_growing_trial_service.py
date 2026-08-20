import os
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta
from threading import Barrier
from types import SimpleNamespace

import pytest
from django.db import IntegrityError, connection, connections

from apps.containers.models import Container
from apps.growing_trials.models import (
    GrowingTrial,
    GrowingTrialStartMethod,
    GrowingTrialStatus,
)
from apps.growing_trials.services import (
    CONTAINER_OCCUPIED,
    END_DATE_BEFORE_START,
    END_DATE_IN_FUTURE,
    GROWING_TRIAL_NOT_ACTIVE,
    GROWING_TRIAL_NOT_ENDABLE,
    GROWING_TRIAL_NOT_FOUND,
    GROWING_TRIAL_NOT_PLANNED,
    GROWING_TRIAL_NOT_TERMINAL,
    INVALID_RESULT_SUMMARY,
    INVALID_TIME_ZONE,
    START_DATE_IN_FUTURE,
    GrowingTrialTransitionError,
    abandon_growing_trial,
    complete_growing_trial,
    start_growing_trial,
    update_growing_trial_result,
)
from apps.plants.models import Plant


@pytest.fixture
def trial():
    return GrowingTrial.objects.create_planned(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot 1'),
    )


def _start(trial, **overrides):
    values = {
        'trial_id': trial.pk,
        'start_date': date.today(),
        'start_method': GrowingTrialStartMethod.SEED,
        'time_zone': 'UTC',
    }
    values.update(overrides)
    return start_growing_trial(**values)


def _end(service, trial, **overrides):
    values = {
        'trial_id': trial.pk,
        'end_date': date.today(),
        'result_summary': None,
        'time_zone': 'UTC',
    }
    values.update(overrides)
    return service(**values)


def _require_postgresql():
    if connection.vendor == 'postgresql':
        return
    if os.environ.get('REQUIRE_POSTGRES') == '1':
        pytest.fail(f'PostgreSQL required, connected to {connection.vendor}')
    pytest.skip('PostgreSQL row-lock behavior only')


def test_required_database_vendor():
    if os.environ.get('REQUIRE_POSTGRES') == '1':
        assert connection.vendor == 'postgresql'


@pytest.mark.django_db
@pytest.mark.parametrize('start_method', GrowingTrialStartMethod.values)
@pytest.mark.parametrize('days_ago', [0, 30, 3650])
def test_start_growing_trial_persists_supported_methods_and_dates(
    trial,
    start_method,
    days_ago,
):
    start_date = date.today() - timedelta(days=days_ago)

    result = _start(trial, start_date=start_date, start_method=start_method)

    assert result.status == GrowingTrialStatus.ACTIVE
    assert result.start_date == start_date
    assert result.start_method == start_method


@pytest.mark.django_db
def test_start_growing_trial_uses_browser_local_date_at_utc_boundary(
    trial,
    monkeypatch,
):
    utc_now = datetime(2026, 8, 15, 1, tzinfo=UTC)
    monkeypatch.setattr(
        'apps.growing_trials.services.timezone.now',
        lambda: utc_now,
    )

    result = _start(
        trial,
        start_date=date(2026, 8, 14),
        time_zone='America/Los_Angeles',
    )

    assert result.start_date == date(2026, 8, 14)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('utc_now', 'time_zone', 'accepted_date', 'future_date'),
    [
        (
            datetime(2026, 3, 8, 7, 30, tzinfo=UTC),
            'America/Los_Angeles',
            date(2026, 3, 7),
            date(2026, 3, 8),
        ),
        (
            datetime(2026, 10, 31, 14, 30, tzinfo=UTC),
            'Pacific/Kiritimati',
            date(2026, 11, 1),
            date(2026, 11, 2),
        ),
    ],
)
def test_start_date_validation_is_deterministic_at_timezone_boundaries(
    trial, monkeypatch, utc_now, time_zone, accepted_date, future_date
):
    monkeypatch.setattr('apps.growing_trials.services.timezone.now', lambda: utc_now)

    with pytest.raises(GrowingTrialTransitionError) as error:
        _start(trial, start_date=future_date, time_zone=time_zone)
    assert error.value.code == START_DATE_IN_FUTURE

    result = _start(trial, start_date=accepted_date, time_zone=time_zone)
    assert result.start_date == accepted_date


@pytest.mark.django_db
def test_start_growing_trial_advances_updated_at(trial, monkeypatch):
    original_updated_at = datetime(2026, 1, 1, tzinfo=UTC)
    transition_time = datetime(2026, 8, 14, 12, tzinfo=UTC)
    GrowingTrial.objects.filter(pk=trial.pk).update(updated_at=original_updated_at)
    monkeypatch.setattr(
        'apps.growing_trials.services.timezone.now', lambda: transition_time
    )

    result = _start(trial, start_date=transition_time.date())

    assert result.updated_at == transition_time
    assert result.updated_at > original_updated_at


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('overrides', 'code', 'message'),
    [
        (
            {'trial_id': 'missing'},
            GROWING_TRIAL_NOT_FOUND,
            'Growing Trial not found.',
        ),
        (
            {'start_date': date.today() + timedelta(days=1)},
            START_DATE_IN_FUTURE,
            'Start date cannot be in the future.',
        ),
        (
            {'time_zone': 'Not/A_Time_Zone'},
            INVALID_TIME_ZONE,
            'Browser time zone is invalid; refresh and try again.',
        ),
    ],
)
def test_start_growing_trial_returns_stable_errors_without_changes(
    trial,
    overrides,
    code,
    message,
):
    with pytest.raises(GrowingTrialTransitionError) as error:
        _start(trial, **overrides)

    assert error.value.code == code
    assert str(error.value) == message
    trial.refresh_from_db()
    assert trial.status == GrowingTrialStatus.PLANNED
    assert trial.start_date is None
    assert trial.start_method is None


@pytest.mark.django_db
@pytest.mark.parametrize(
    'status',
    [
        GrowingTrialStatus.ACTIVE,
        GrowingTrialStatus.COMPLETED,
        GrowingTrialStatus.ABANDONED,
    ],
)
def test_start_growing_trial_rejects_non_planned_lifecycle_without_changes(
    trial,
    status,
):
    original = {
        'status': status,
        'start_date': (
            date(2026, 1, 1)
            if status in [GrowingTrialStatus.ACTIVE, GrowingTrialStatus.COMPLETED]
            else None
        ),
        'start_method': (
            GrowingTrialStartMethod.SEED
            if status in [GrowingTrialStatus.ACTIVE, GrowingTrialStatus.COMPLETED]
            else None
        ),
        'end_date': (
            date(2026, 1, 2)
            if status
            in [
                GrowingTrialStatus.COMPLETED,
                GrowingTrialStatus.ABANDONED,
            ]
            else None
        ),
    }
    GrowingTrial.objects.filter(pk=trial.pk).update(**original)

    with pytest.raises(GrowingTrialTransitionError) as error:
        _start(trial)

    assert error.value.code == GROWING_TRIAL_NOT_PLANNED
    trial.refresh_from_db()
    assert {key: getattr(trial, key) for key in original} == original


@pytest.mark.django_db
def test_start_growing_trial_rejects_an_occupied_container(trial):
    occupying_trial = GrowingTrial.objects.create_planned(
        plant=Plant.objects.create(name='Basil'),
        container=trial.container,
    )
    _start(occupying_trial)

    with pytest.raises(GrowingTrialTransitionError) as error:
        _start(trial)

    assert error.value.code == CONTAINER_OCCUPIED
    assert str(error.value) == 'This Container already has an active Growing Trial.'
    trial.refresh_from_db()
    assert trial.status == GrowingTrialStatus.PLANNED


@pytest.mark.django_db
def test_trials_in_separate_containers_start_independently(trial):
    other = GrowingTrial.objects.create_planned(
        plant=trial.plant,
        container=Container.objects.create(name='Pot 2'),
    )

    _start(trial)
    _start(other, start_method=GrowingTrialStartMethod.SEEDLING_TRANSPLANT)

    assert GrowingTrial.objects.filter(status=GrowingTrialStatus.ACTIVE).count() == 2


@pytest.mark.django_db
def test_active_container_integrity_race_maps_to_container_error(trial, monkeypatch):
    error = IntegrityError('unique violation')
    cause = Exception('database error')
    cause.diag = SimpleNamespace(
        constraint_name='one_active_growing_trial_per_container'
    )
    error.__cause__ = cause

    def fail_save(*args, **kwargs):
        raise error

    monkeypatch.setattr(GrowingTrial, 'save', fail_save)

    with pytest.raises(GrowingTrialTransitionError) as transition_error:
        _start(trial)

    assert transition_error.value.code == CONTAINER_OCCUPIED


@pytest.mark.django_db
def test_unrelated_integrity_error_is_not_hidden(trial, monkeypatch):
    error = IntegrityError('unrelated constraint')

    def fail_save(*args, **kwargs):
        raise error

    monkeypatch.setattr(GrowingTrial, 'save', fail_save)

    with pytest.raises(IntegrityError) as raised:
        _start(trial)

    assert raised.value is error


@pytest.mark.django_db(transaction=True)
def test_postgresql_concurrent_starts_leave_exactly_one_active_trial():
    _require_postgresql()

    plant = Plant.objects.create(name='Radish')
    container = Container.objects.create(name='Pot 1')
    trials = [
        GrowingTrial.objects.create_planned(plant=plant, container=container)
        for _ in range(2)
    ]
    barrier = Barrier(2)

    def start(trial_id):
        connections.close_all()
        barrier.wait()
        try:
            start_growing_trial(
                trial_id=trial_id,
                start_date=date.today(),
                start_method=GrowingTrialStartMethod.SEED,
                time_zone='UTC',
            )
            return 'started'
        except GrowingTrialTransitionError as error:
            return error.code
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(start, [trial.pk for trial in trials]))

    assert sorted(results) == [CONTAINER_OCCUPIED, 'started']
    assert GrowingTrial.objects.filter(status=GrowingTrialStatus.ACTIVE).count() == 1


@pytest.mark.django_db(transaction=True)
def test_postgresql_concurrent_starts_of_same_trial_persist_one_winner():
    _require_postgresql()
    trial = GrowingTrial.objects.create_planned(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot 1'),
    )
    barrier = Barrier(2)
    attempts = [
        (date.today() - timedelta(days=1), GrowingTrialStartMethod.SEED),
        (date.today(), GrowingTrialStartMethod.SEEDLING_TRANSPLANT),
    ]

    def start(attempt):
        connections.close_all()
        barrier.wait()
        try:
            result = start_growing_trial(
                trial_id=trial.pk,
                start_date=attempt[0],
                start_method=attempt[1],
                time_zone='UTC',
            )
            return ('started', result.start_date, result.start_method)
        except GrowingTrialTransitionError as error:
            return (error.code, None, None)
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(start, attempts))

    assert sorted(result[0] for result in results) == [
        GROWING_TRIAL_NOT_PLANNED,
        'started',
    ]
    winning_result = next(result for result in results if result[0] == 'started')
    trial.refresh_from_db()
    assert trial.status == GrowingTrialStatus.ACTIVE
    assert (trial.start_date, trial.start_method) == winning_result[1:]
    assert GrowingTrial.objects.filter(pk=trial.pk).count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('service', 'initial_status', 'target_status'),
    [
        (
            complete_growing_trial,
            GrowingTrialStatus.ACTIVE,
            GrowingTrialStatus.COMPLETED,
        ),
        (
            abandon_growing_trial,
            GrowingTrialStatus.ACTIVE,
            GrowingTrialStatus.ABANDONED,
        ),
        (
            abandon_growing_trial,
            GrowingTrialStatus.PLANNED,
            GrowingTrialStatus.ABANDONED,
        ),
    ],
)
def test_end_growing_trial_persists_terminal_details(
    trial,
    service,
    initial_status,
    target_status,
):
    if initial_status == GrowingTrialStatus.ACTIVE:
        _start(trial, start_date=date.today() - timedelta(days=1))

    result = _end(
        service,
        trial,
        result_summary='  Healthy harvest.  ',
    )

    assert result.status == target_status
    assert result.end_date == date.today()
    assert result.result_summary == 'Healthy harvest.'
    if initial_status == GrowingTrialStatus.PLANNED:
        assert result.start_date is None
        assert result.start_method is None


@pytest.mark.django_db
@pytest.mark.parametrize('summary', [None, '', '   ', 'x' * 5000])
def test_end_growing_trial_accepts_optional_summary_at_limit(trial, summary):
    _start(trial)

    result = _end(complete_growing_trial, trial, result_summary=summary)

    assert result.result_summary == (summary or '').strip()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('service', 'status', 'expected_code'),
    [
        (complete_growing_trial, GrowingTrialStatus.PLANNED, GROWING_TRIAL_NOT_ACTIVE),
        (
            complete_growing_trial,
            GrowingTrialStatus.COMPLETED,
            GROWING_TRIAL_NOT_ACTIVE,
        ),
        (
            complete_growing_trial,
            GrowingTrialStatus.ABANDONED,
            GROWING_TRIAL_NOT_ACTIVE,
        ),
        (
            abandon_growing_trial,
            GrowingTrialStatus.COMPLETED,
            GROWING_TRIAL_NOT_ENDABLE,
        ),
        (
            abandon_growing_trial,
            GrowingTrialStatus.ABANDONED,
            GROWING_TRIAL_NOT_ENDABLE,
        ),
    ],
)
def test_end_growing_trial_rejects_invalid_lifecycle(
    trial,
    service,
    status,
    expected_code,
):
    if status in [GrowingTrialStatus.COMPLETED, GrowingTrialStatus.ABANDONED]:
        GrowingTrial.objects.filter(pk=trial.pk).update(
            status=status,
            end_date=date.today(),
            start_date=(
                date.today() if status == GrowingTrialStatus.COMPLETED else None
            ),
            start_method=(
                GrowingTrialStartMethod.SEED
                if status == GrowingTrialStatus.COMPLETED
                else None
            ),
        )

    with pytest.raises(GrowingTrialTransitionError) as error:
        _end(service, trial)

    assert error.value.code == expected_code
    trial.refresh_from_db()
    assert trial.status == status


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('overrides', 'expected_code'),
    [
        ({'trial_id': 'missing'}, GROWING_TRIAL_NOT_FOUND),
        ({'time_zone': 'Not/A_Time_Zone'}, INVALID_TIME_ZONE),
        ({'end_date': date.today() + timedelta(days=1)}, END_DATE_IN_FUTURE),
        ({'result_summary': 'x' * 5001}, INVALID_RESULT_SUMMARY),
    ],
)
def test_end_growing_trial_rejects_invalid_values_without_partial_writes(
    trial,
    overrides,
    expected_code,
):
    _start(trial)

    with pytest.raises(GrowingTrialTransitionError) as error:
        _end(complete_growing_trial, trial, **overrides)

    assert error.value.code == expected_code
    trial.refresh_from_db()
    assert trial.status == GrowingTrialStatus.ACTIVE
    assert trial.end_date is None
    assert trial.result_summary == ''


@pytest.mark.django_db
def test_end_date_uses_browser_local_date_and_cannot_precede_start(trial, monkeypatch):
    utc_now = datetime(2026, 8, 15, 1, tzinfo=UTC)
    monkeypatch.setattr('apps.growing_trials.services.timezone.now', lambda: utc_now)
    _start(
        trial,
        start_date=date(2026, 8, 14),
        time_zone='America/Los_Angeles',
    )

    with pytest.raises(GrowingTrialTransitionError) as future_error:
        _end(
            complete_growing_trial,
            trial,
            end_date=date(2026, 8, 15),
            time_zone='America/Los_Angeles',
        )
    assert future_error.value.code == END_DATE_IN_FUTURE

    with pytest.raises(GrowingTrialTransitionError) as before_error:
        _end(
            complete_growing_trial,
            trial,
            end_date=date(2026, 8, 13),
            time_zone='America/Los_Angeles',
        )
    assert before_error.value.code == END_DATE_BEFORE_START

    result = _end(
        complete_growing_trial,
        trial,
        end_date=date(2026, 8, 14),
        time_zone='America/Los_Angeles',
    )
    assert result.end_date == date(2026, 8, 14)


@pytest.mark.django_db
@pytest.mark.parametrize(
    'status', [GrowingTrialStatus.COMPLETED, GrowingTrialStatus.ABANDONED]
)
def test_update_growing_trial_result_preserves_terminal_status(trial, status):
    if status == GrowingTrialStatus.COMPLETED:
        _start(trial, start_date=date.today() - timedelta(days=2))
        _end(complete_growing_trial, trial, end_date=date.today() - timedelta(days=1))
    else:
        _end(abandon_growing_trial, trial, end_date=date.today() - timedelta(days=1))

    original_updated_at = trial.updated_at
    result = _end(
        update_growing_trial_result,
        trial,
        end_date=date.today(),
        result_summary='  Revised result  ',
    )

    assert result.status == status
    assert result.end_date == date.today()
    assert result.result_summary == 'Revised result'
    assert result.updated_at > original_updated_at


@pytest.mark.django_db
@pytest.mark.parametrize(
    'status', [GrowingTrialStatus.PLANNED, GrowingTrialStatus.ACTIVE]
)
def test_update_growing_trial_result_rejects_non_terminal_trials(trial, status):
    if status == GrowingTrialStatus.ACTIVE:
        _start(trial)

    with pytest.raises(GrowingTrialTransitionError) as error:
        _end(update_growing_trial_result, trial)

    assert error.value.code == GROWING_TRIAL_NOT_TERMINAL


@pytest.mark.django_db
def test_ending_active_trial_releases_container(trial):
    _start(trial)
    _end(complete_growing_trial, trial)
    next_trial = GrowingTrial.objects.create_planned(
        plant=trial.plant,
        container=trial.container,
    )

    result = _start(next_trial)

    assert result.status == GrowingTrialStatus.ACTIVE


@pytest.mark.django_db
def test_terminal_mutations_advance_updated_at(trial, monkeypatch):
    start_time = datetime(2026, 8, 12, 12, tzinfo=UTC)
    end_time = datetime(2026, 8, 13, 12, tzinfo=UTC)
    monkeypatch.setattr('apps.growing_trials.services.timezone.now', lambda: start_time)
    _start(trial, start_date=start_time.date())
    monkeypatch.setattr('apps.growing_trials.services.timezone.now', lambda: end_time)

    result = _end(complete_growing_trial, trial, end_date=end_time.date())

    assert result.updated_at == end_time


@pytest.mark.django_db(transaction=True)
def test_postgresql_concurrent_complete_attempts_persist_one_winner():
    _require_postgresql()
    trial = GrowingTrial.objects.create_planned(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot 1'),
    )
    start_growing_trial(
        trial_id=trial.pk,
        start_date=date.today() - timedelta(days=1),
        start_method=GrowingTrialStartMethod.SEED,
        time_zone='UTC',
    )
    barrier = Barrier(2)

    def complete(summary):
        connections.close_all()
        barrier.wait()
        try:
            result = complete_growing_trial(
                trial_id=trial.pk,
                end_date=date.today(),
                result_summary=summary,
                time_zone='UTC',
            )
            return ('completed', result.result_summary)
        except GrowingTrialTransitionError as error:
            return (error.code, None)
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(complete, ['First', 'Second']))

    assert sorted(result[0] for result in results) == [
        GROWING_TRIAL_NOT_ACTIVE,
        'completed',
    ]
    winner = next(result for result in results if result[0] == 'completed')
    trial.refresh_from_db()
    assert trial.result_summary == winner[1]


@pytest.mark.django_db(transaction=True)
def test_postgresql_concurrent_complete_and_abandon_persist_one_winner():
    _require_postgresql()
    trial = GrowingTrial.objects.create_planned(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot 1'),
    )
    start_growing_trial(
        trial_id=trial.pk,
        start_date=date.today(),
        start_method=GrowingTrialStartMethod.SEED,
        time_zone='UTC',
    )
    barrier = Barrier(2)

    def end(service):
        connections.close_all()
        barrier.wait()
        try:
            result = service(
                trial_id=trial.pk,
                end_date=date.today(),
                result_summary=None,
                time_zone='UTC',
            )
            return result.status
        except GrowingTrialTransitionError as error:
            return error.code
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(end, [complete_growing_trial, abandon_growing_trial])
        )

    assert (
        len(set(results) & {GrowingTrialStatus.COMPLETED, GrowingTrialStatus.ABANDONED})
        == 1
    )
    assert (
        len(set(results) & {GROWING_TRIAL_NOT_ACTIVE, GROWING_TRIAL_NOT_ENDABLE}) == 1
    )


@pytest.mark.django_db(transaction=True)
def test_postgresql_end_and_start_race_preserves_container_invariant():
    _require_postgresql()
    plant = Plant.objects.create(name='Radish')
    container = Container.objects.create(name='Pot 1')
    active_trial = GrowingTrial.objects.create_planned(
        plant=plant,
        container=container,
    )
    planned_trial = GrowingTrial.objects.create_planned(
        plant=plant,
        container=container,
    )
    start_growing_trial(
        trial_id=active_trial.pk,
        start_date=date.today(),
        start_method=GrowingTrialStartMethod.SEED,
        time_zone='UTC',
    )
    barrier = Barrier(2)

    def complete_active():
        connections.close_all()
        barrier.wait()
        try:
            complete_growing_trial(
                trial_id=active_trial.pk,
                end_date=date.today(),
                result_summary=None,
                time_zone='UTC',
            )
            return 'completed'
        finally:
            connections.close_all()

    def start_planned():
        connections.close_all()
        barrier.wait()
        try:
            start_growing_trial(
                trial_id=planned_trial.pk,
                start_date=date.today(),
                start_method=GrowingTrialStartMethod.SEED,
                time_zone='UTC',
            )
            return 'started'
        except GrowingTrialTransitionError as error:
            return error.code
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        complete_result = executor.submit(complete_active)
        start_result = executor.submit(start_planned)

    assert complete_result.result() == 'completed'
    assert start_result.result() in ['started', CONTAINER_OCCUPIED]
    assert (
        GrowingTrial.objects.filter(
            container=container,
            status=GrowingTrialStatus.ACTIVE,
        ).count()
        <= 1
    )
