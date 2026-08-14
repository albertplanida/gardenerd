import strawberry
import strawberry_django

from apps.plants.models import Plant


@strawberry_django.type(Plant)
class PlantType:
    id: strawberry.auto
    name: strawberry.auto
    care_notes: strawberry.auto
    created_at: strawberry.auto
    updated_at: strawberry.auto
