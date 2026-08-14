import pytest
from django.core.exceptions import ValidationError
from django.db.models.deletion import ProtectedError

from apps.containers.models import Container
from apps.growing_trials.models import (
    GROWING_TRIAL_INITIAL_STATUS_MESSAGE,
    GrowingTrial,
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
def test_growing_trial_can_be_created_as_planned(plant, container):
    trial = GrowingTrial.objects.create(plant=plant, container=container)

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
def test_growing_trial_rejects_non_planned_initial_status(plant, container):
    with pytest.raises(ValidationError) as error:
        GrowingTrial.objects.create(
            plant=plant,
            container=container,
            status='active',
        )

    assert error.value.message_dict == {
        'status': [GROWING_TRIAL_INITIAL_STATUS_MESSAGE]
    }
    assert GrowingTrial.objects.count() == 0
