from enum import Enum

import strawberry
import strawberry_django

from apps.containers.graphql.Container.types import ContainerType
from apps.growing_trials.models import GrowingTrial
from apps.plants.graphql.Plant.types import PlantType


@strawberry.enum
class GrowingTrialStatusType(Enum):
    PLANNED = 'planned'


@strawberry_django.type(GrowingTrial)
class GrowingTrialType:
    id: strawberry.auto
    plant: PlantType
    container: ContainerType
    created_at: strawberry.auto
    updated_at: strawberry.auto

    @strawberry.field
    def status(self) -> GrowingTrialStatusType:
        return GrowingTrialStatusType(self.status)
