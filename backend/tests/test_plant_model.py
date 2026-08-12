import pytest

from apps.plants.models import Plant


@pytest.mark.django_db
def test_plant_can_be_created_with_name_and_care_notes():
    plant = Plant.objects.create(
        name='Radish',
        care_notes='Keep soil evenly moist.',
    )

    assert plant.name == 'Radish'
    assert plant.care_notes == 'Keep soil evenly moist.'
    assert plant.created_at is not None
    assert plant.updated_at is not None


@pytest.mark.django_db
def test_plant_can_be_created_without_care_notes():
    plant = Plant.objects.create(name='Lettuce')

    assert plant.care_notes == ''


@pytest.mark.django_db
def test_plant_string_representation_is_name():
    plant = Plant.objects.create(name='Basil')

    assert str(plant) == 'Basil'
