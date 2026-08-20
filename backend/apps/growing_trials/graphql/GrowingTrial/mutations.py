import datetime
import logging

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
    abandon_growing_trial,
    complete_growing_trial,
    start_growing_trial,
    update_growing_trial_result,
)
from apps.plants.models import Plant

PLANT_NOT_FOUND_MESSAGE = 'Plant not found'
CONTAINER_NOT_FOUND_MESSAGE = 'Container not found'
logger = logging.getLogger(__name__)


def _run_lifecycle_mutation(operation, action: str, trial_id: strawberry.ID, **values):
    try:
        return operation(trial_id=trial_id, **values)
    except GrowingTrialTransitionError as exc:
        raise GraphQLError(str(exc), extensions={'code': exc.code}) from exc
    except Exception as exc:
        logger.exception('Unexpected error while %s Growing Trial %s', action, trial_id)
        raise GraphQLError(
            'Internal server error.',
            extensions={'code': 'INTERNAL_ERROR'},
        ) from exc


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
        return _run_lifecycle_mutation(
            start_growing_trial,
            'starting',
            id,
            start_date=start_date,
            start_method=start_method.value,
            time_zone=time_zone,
        )

    @strawberry.mutation
    def complete_growing_trial(
        self,
        id: strawberry.ID,
        end_date: datetime.date,
        result_summary: str | None,
        time_zone: str,
    ) -> GrowingTrialType:
        return _run_lifecycle_mutation(
            complete_growing_trial,
            'completing',
            id,
            end_date=end_date,
            result_summary=result_summary,
            time_zone=time_zone,
        )

    @strawberry.mutation
    def abandon_growing_trial(
        self,
        id: strawberry.ID,
        end_date: datetime.date,
        result_summary: str | None,
        time_zone: str,
    ) -> GrowingTrialType:
        return _run_lifecycle_mutation(
            abandon_growing_trial,
            'abandoning',
            id,
            end_date=end_date,
            result_summary=result_summary,
            time_zone=time_zone,
        )

    @strawberry.mutation
    def update_growing_trial_result(
        self,
        id: strawberry.ID,
        end_date: datetime.date,
        result_summary: str | None,
        time_zone: str,
    ) -> GrowingTrialType:
        return _run_lifecycle_mutation(
            update_growing_trial_result,
            'updating result for',
            id,
            end_date=end_date,
            result_summary=result_summary,
            time_zone=time_zone,
        )
