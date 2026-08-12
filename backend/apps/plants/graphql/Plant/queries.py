import strawberry

from apps.plants.graphql.Plant.types import PlantType
from apps.plants.models import Plant


@strawberry.type
class PlantQueries:
    @strawberry.field
    def plants(self) -> list[PlantType]:
        return Plant.objects.order_by('id')
