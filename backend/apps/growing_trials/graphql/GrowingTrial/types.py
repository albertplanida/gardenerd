from enum import Enum

import strawberry
import strawberry_django

from apps.containers.graphql.Container.types import ContainerType
from apps.growing_trials.models import GrowingTrial
from apps.plants.graphql.Plant.types import PlantType


@strawberry.enum
class GrowingTrialStatusType(Enum):
    PLANNED = 'planned'
    ACTIVE = 'active'
    COMPLETED = 'completed'
    ABANDONED = 'abandoned'


@strawberry.enum
class GrowingTrialStartMethod(Enum):
    SEED = 'seed'
    SEEDLING_TRANSPLANT = 'seedling_transplant'


@strawberry_django.type(GrowingTrial)
class GrowingTrialType:
    id: strawberry.auto
    plant: PlantType
    container: ContainerType
    start_date: strawberry.auto
    created_at: strawberry.auto
    updated_at: strawberry.auto

    @strawberry.field
    def status(self) -> GrowingTrialStatusType:
        return GrowingTrialStatusType(self.status)

    @strawberry.field
    def start_method(self) -> GrowingTrialStartMethod | None:
        if self.start_method is None:
            return None
        return GrowingTrialStartMethod(self.start_method)
