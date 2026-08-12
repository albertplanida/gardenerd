import strawberry
from django.core.exceptions import ValidationError

from apps.plants.graphql.Plant.types import PlantType
from apps.plants.models import (
    PLANT_CARE_NOTES_MAX_LENGTH_MESSAGE,
    PLANT_NAME_MAX_LENGTH_MESSAGE,
    PLANT_NAME_REQUIRED_MESSAGE,
    Plant,
)

SAFE_VALIDATION_MESSAGES = {
    PLANT_NAME_REQUIRED_MESSAGE,
    PLANT_NAME_MAX_LENGTH_MESSAGE,
    PLANT_CARE_NOTES_MAX_LENGTH_MESSAGE,
}


def _raise_safe_validation_error(error: ValidationError):
    if hasattr(error, 'message_dict'):
        messages = [
            message for values in error.message_dict.values() for message in values
        ]
    else:
        messages = error.messages

    safe_message = next(
        (message for message in messages if message in SAFE_VALIDATION_MESSAGES),
        messages[0],
    )

    raise ValueError(safe_message) from error


@strawberry.type
class PlantMutations:
    @strawberry.mutation
    def create_plant(self, name: str, care_notes: str = '') -> PlantType:
        plant = Plant(name=name, care_notes=care_notes)

        try:
            plant.save()
        except ValidationError as exc:
            _raise_safe_validation_error(exc)

        return plant

    @strawberry.mutation
    def edit_plant(
        self,
        id: strawberry.ID,
        name: str,
        care_notes: str = '',
    ) -> PlantType:
        try:
            plant = Plant.objects.get(pk=id)
        except Plant.DoesNotExist as exc:
            raise ValueError('Plant not found') from exc

        plant.name = name
        plant.care_notes = care_notes

        try:
            plant.save(update_fields=['name', 'care_notes', 'updated_at'])
        except ValidationError as exc:
            _raise_safe_validation_error(exc)

        return plant
