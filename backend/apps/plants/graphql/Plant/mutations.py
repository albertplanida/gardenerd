import strawberry

from apps.plants.graphql.Plant.types import PlantType
from apps.plants.models import Plant


@strawberry.type
class PlantMutations:
    @strawberry.mutation
    def create_plant(self, name: str, care_notes: str = '') -> PlantType:
        return Plant.objects.create(name=name, care_notes=care_notes)

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
        plant.save(update_fields=['name', 'care_notes', 'updated_at'])
        return plant
