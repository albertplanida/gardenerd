from datetime import date

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError

from apps.containers.models import Container
from apps.growing_trials.models import (
    GrowingTrial,
    GrowingTrialStartMethod,
    GrowingTrialStatus,
)
from apps.plants.models import Plant


@pytest.fixture
def plant():
    return Plant.objects.create(name='Radish')


@pytest.fixture
def container():
    return Container.objects.create(name='Pot 1')


@pytest.mark.django_db
def test_create_planned_creates_a_valid_planned_trial(plant, container):
    trial = GrowingTrial.objects.create_planned(plant=plant, container=container)

    assert trial.plant == plant
    assert trial.container == container
    assert trial.status == GrowingTrialStatus.PLANNED
    assert trial.created_at is not None
    assert trial.updated_at is not None


@pytest.mark.django_db
def test_growing_trial_string_representation_names_plant_and_container(
    plant,
    container,
):
    trial = GrowingTrial.objects.create(plant=plant, container=container)

    assert str(trial) == 'Radish in Pot 1'


@pytest.mark.django_db
@pytest.mark.parametrize('related_record', ['plant', 'container'])
def test_growing_trial_protects_related_records(plant, container, related_record):
    GrowingTrial.objects.create(plant=plant, container=container)

    with pytest.raises(ProtectedError):
        {'plant': plant, 'container': container}[related_record].delete()


@pytest.mark.django_db
@pytest.mark.parametrize('missing_relationship', ['plant', 'container'])
def test_growing_trial_requires_each_relationship(
    plant,
    container,
    missing_relationship,
):
    relationships = {'plant': plant, 'container': container}
    relationships[missing_relationship] = None

    with pytest.raises(ValidationError):
        GrowingTrial.objects.create(**relationships)

    assert GrowingTrial.objects.count() == 0


@pytest.mark.django_db
def test_direct_creation_uses_the_field_default(plant, container):
    trial = GrowingTrial.objects.create(plant=plant, container=container)

    assert trial.status == GrowingTrialStatus.PLANNED


@pytest.mark.django_db
def test_normal_save_validates_status(plant, container):
    trial = GrowingTrial.objects.create_planned(plant=plant, container=container)
    trial.status = 'invalid'

    with pytest.raises(ValidationError) as error:
        trial.save()

    assert 'status' in error.value.message_dict
    trial.refresh_from_db()
    assert trial.status == GrowingTrialStatus.PLANNED


@pytest.mark.django_db
def test_bulk_create_bypasses_the_domain_creation_method(plant, container):
    trial = GrowingTrial(plant=plant, container=container)

    GrowingTrial.objects.bulk_create([trial])

    assert trial.status == GrowingTrialStatus.PLANNED
    assert GrowingTrial.objects.get().status == GrowingTrialStatus.PLANNED


@pytest.mark.django_db
def test_queryset_update_bypasses_model_validation(plant, container):
    trial = GrowingTrial.objects.create_planned(plant=plant, container=container)

    assert (
        GrowingTrial.objects.filter(pk=trial.pk).update(
            status=GrowingTrialStatus.PLANNED
        )
        == 1
    )


@pytest.mark.django_db
def test_database_rejects_invalid_status_from_bulk_create(plant, container):
    with pytest.raises(IntegrityError), transaction.atomic():
        GrowingTrial.objects.bulk_create(
            [GrowingTrial(plant=plant, container=container, status='invalid')]
        )

    assert GrowingTrial.objects.count() == 0


@pytest.mark.django_db
def test_database_rejects_invalid_status_from_queryset_update(plant, container):
    trial = GrowingTrial.objects.create_planned(plant=plant, container=container)

    with pytest.raises(IntegrityError), transaction.atomic():
        GrowingTrial.objects.filter(pk=trial.pk).update(status='invalid')

    trial.refresh_from_db()
    assert trial.status == GrowingTrialStatus.PLANNED


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('changes', 'constraint_names'),
    [
        (
            {
                'status': GrowingTrialStatus.COMPLETED,
                'start_date': '2026-08-14',
            },
            (
                'growing_trial_start_fields_together',
                'growing_trial_completed_has_start',
            ),
        ),
        (
            {
                'status': GrowingTrialStatus.PLANNED,
                'start_date': '2026-08-14',
                'start_method': GrowingTrialStartMethod.SEED,
            },
            ('growing_trial_planned_without_start',),
        ),
        (
            {'status': GrowingTrialStatus.ACTIVE},
            ('growing_trial_active_has_start',),
        ),
        (
            {
                'status': GrowingTrialStatus.COMPLETED,
                'start_date': '2026-08-14',
                'start_method': 'cutting',
            },
            ('growing_trial_valid_start_method',),
        ),
    ],
)
def test_database_rejects_invalid_start_states(
    plant,
    container,
    changes,
    constraint_names,
):
    trial = GrowingTrial.objects.create_planned(plant=plant, container=container)

    with pytest.raises(IntegrityError) as error, transaction.atomic():
        GrowingTrial.objects.filter(pk=trial.pk).update(**changes)

    assert any(name in str(error.value) for name in constraint_names)


LIFECYCLE_MATRIX = [
    (GrowingTrialStatus.PLANNED, None, None, True),
    (GrowingTrialStatus.PLANNED, '2026-08-14', GrowingTrialStartMethod.SEED, False),
    (GrowingTrialStatus.PLANNED, '2026-08-14', None, False),
    (GrowingTrialStatus.PLANNED, None, GrowingTrialStartMethod.SEED, False),
    (GrowingTrialStatus.ACTIVE, None, None, False),
    (GrowingTrialStatus.ACTIVE, '2026-08-14', GrowingTrialStartMethod.SEED, True),
    (GrowingTrialStatus.ACTIVE, '2026-08-14', None, False),
    (GrowingTrialStatus.ACTIVE, None, GrowingTrialStartMethod.SEED, False),
    (GrowingTrialStatus.COMPLETED, None, None, False),
    (GrowingTrialStatus.COMPLETED, '2026-08-14', GrowingTrialStartMethod.SEED, True),
    (GrowingTrialStatus.COMPLETED, '2026-08-14', None, False),
    (GrowingTrialStatus.COMPLETED, None, GrowingTrialStartMethod.SEED, False),
    (GrowingTrialStatus.ABANDONED, None, None, True),
    (GrowingTrialStatus.ABANDONED, '2026-08-14', GrowingTrialStartMethod.SEED, True),
    (GrowingTrialStatus.ABANDONED, '2026-08-14', None, False),
    (GrowingTrialStatus.ABANDONED, None, GrowingTrialStartMethod.SEED, False),
]


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('status', 'start_date', 'start_method', 'is_valid'), LIFECYCLE_MATRIX
)
def test_model_save_enforces_lifecycle_matrix(
    plant, container, status, start_date, start_method, is_valid
):
    trial = GrowingTrial(
        plant=plant,
        container=container,
        status=status,
        start_date=start_date,
        start_method=start_method,
    )

    if is_valid:
        trial.save()
        assert trial.pk is not None
    else:
        with pytest.raises(ValidationError):
            trial.save()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('status', 'start_date', 'start_method', 'is_valid'), LIFECYCLE_MATRIX
)
def test_queryset_update_enforces_lifecycle_matrix(
    plant, container, status, start_date, start_method, is_valid
):
    trial = GrowingTrial.objects.create_planned(plant=plant, container=container)
    changes = {
        'status': status,
        'start_date': start_date,
        'start_method': start_method,
    }

    if is_valid:
        assert GrowingTrial.objects.filter(pk=trial.pk).update(**changes) == 1
        trial.refresh_from_db()
        assert (trial.status, trial.start_date, trial.start_method) == (
            status,
            None if start_date is None else date.fromisoformat(start_date),
            start_method,
        )
    else:
        with pytest.raises(IntegrityError), transaction.atomic():
            GrowingTrial.objects.filter(pk=trial.pk).update(**changes)


@pytest.mark.django_db
def test_database_rejects_two_active_trials_for_one_container(plant, container):
    first = GrowingTrial.objects.create_planned(plant=plant, container=container)
    second = GrowingTrial.objects.create_planned(plant=plant, container=container)
    active_values = {
        'status': GrowingTrialStatus.ACTIVE,
        'start_date': '2026-08-14',
        'start_method': GrowingTrialStartMethod.SEED,
    }
    GrowingTrial.objects.filter(pk=first.pk).update(**active_values)

    with pytest.raises(IntegrityError), transaction.atomic():
        GrowingTrial.objects.filter(pk=second.pk).update(**active_values)

    second.refresh_from_db()
    assert second.status == GrowingTrialStatus.PLANNED
