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
    GROWING_TRIAL_NOT_FOUND,
    GROWING_TRIAL_NOT_PLANNED,
    INVALID_TIME_ZONE,
    START_DATE_IN_FUTURE,
    GrowingTrialTransitionError,
    start_growing_trial,
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
        'start_date': date(2026, 1, 1) if status == GrowingTrialStatus.ACTIVE else None,
        'start_method': (
            GrowingTrialStartMethod.SEED
            if status == GrowingTrialStatus.ACTIVE
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
    if connection.vendor != 'postgresql':
        pytest.skip('PostgreSQL row-lock behavior only')

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
