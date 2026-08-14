import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError

from apps.containers.models import Container
from apps.growing_trials.models import GrowingTrial, GrowingTrialStatus
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
