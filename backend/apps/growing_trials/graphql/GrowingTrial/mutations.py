import strawberry
from django.core.exceptions import ValidationError

from apps.containers.models import Container
from apps.growing_trials.graphql.GrowingTrial.types import GrowingTrialType
from apps.growing_trials.models import GrowingTrial
from apps.plants.models import Plant

PLANT_NOT_FOUND_MESSAGE = 'Plant not found'
CONTAINER_NOT_FOUND_MESSAGE = 'Container not found'


def _get_plant(plant_id: strawberry.ID) -> Plant:
    try:
        return Plant.objects.get(pk=plant_id)
    except (Plant.DoesNotExist, TypeError, ValueError, ValidationError) as exc:
        raise ValueError(PLANT_NOT_FOUND_MESSAGE) from exc


def _get_container(container_id: strawberry.ID) -> Container:
    try:
        return Container.objects.get(pk=container_id)
    except (Container.DoesNotExist, TypeError, ValueError, ValidationError) as exc:
        raise ValueError(CONTAINER_NOT_FOUND_MESSAGE) from exc


@strawberry.type
class GrowingTrialMutations:
    @strawberry.mutation
    def create_growing_trial(
        self,
        plant_id: strawberry.ID,
        container_id: strawberry.ID,
    ) -> GrowingTrialType:
        trial = GrowingTrial(
            plant=_get_plant(plant_id),
            container=_get_container(container_id),
        )
        trial.save()
        return trial
