import datetime

import strawberry
from django.core.exceptions import ValidationError
from graphql import GraphQLError

from apps.containers.models import Container
from apps.growing_trials.graphql.GrowingTrial.types import (
    GrowingTrialStartMethod,
    GrowingTrialType,
)
from apps.growing_trials.models import GrowingTrial
from apps.growing_trials.services import (
    GrowingTrialTransitionError,
    start_growing_trial,
)
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
        return GrowingTrial.objects.create_planned(
            plant=_get_plant(plant_id),
            container=_get_container(container_id),
        )

    @strawberry.mutation
    def start_growing_trial(
        self,
        id: strawberry.ID,
        start_date: datetime.date,
        start_method: GrowingTrialStartMethod,
        time_zone: str,
    ) -> GrowingTrialType:
        try:
            return start_growing_trial(
                trial_id=id,
                start_date=start_date,
                start_method=start_method.value,
                time_zone=time_zone,
            )
        except GrowingTrialTransitionError as exc:
            raise GraphQLError(str(exc), extensions={'code': exc.code}) from exc
        except Exception as exc:
            raise GraphQLError(
                'Internal server error.',
                extensions={'code': 'INTERNAL_ERROR'},
            ) from exc
