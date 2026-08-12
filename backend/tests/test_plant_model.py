import pytest
from django.core.exceptions import ValidationError

from apps.plants.models import PLANT_CARE_NOTES_MAX_LENGTH, Plant


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


@pytest.mark.django_db
def test_plant_save_normalizes_name_and_care_notes():
    plant = Plant.objects.create(
        name='  Basil  ',
        care_notes='  Keep moist  ',
    )

    assert plant.name == 'Basil'
    assert plant.care_notes == 'Keep moist'


@pytest.mark.django_db
def test_plant_save_rejects_blank_name():
    plant = Plant(name='   ')

    with pytest.raises(ValidationError):
        plant.save()

    assert Plant.objects.count() == 0


@pytest.mark.django_db
def test_plant_save_rejects_oversized_care_notes():
    plant = Plant(name='Tomato', care_notes='x' * (PLANT_CARE_NOTES_MAX_LENGTH + 1))

    with pytest.raises(ValidationError):
        plant.save()

    assert Plant.objects.count() == 0
