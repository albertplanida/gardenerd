import pytest
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
