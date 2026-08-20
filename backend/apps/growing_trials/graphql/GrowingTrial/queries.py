import base64
import binascii

import strawberry
from django.db.models.functions import Lower

from apps.containers.models import CONTAINER_NAME_MAX_LENGTH, Container
from apps.growing_trials.graphql.GrowingTrial.types import (
    GrowingTrialStatusType,
    GrowingTrialType,
)
from apps.growing_trials.models import GrowingTrial
from apps.plants.models import PLANT_NAME_MAX_LENGTH, Plant

DEFAULT_GROWING_TRIALS_QUERY_LIMIT = 20
MAX_GROWING_TRIALS_QUERY_LIMIT = 50
GROWING_TRIAL_CURSOR_PREFIX = 'growing-trial:v1:'
INVALID_GROWING_TRIAL_CURSOR_MESSAGE = 'Invalid Growing Trial cursor'
INVALID_OPTION_LIMIT_MESSAGE = 'Growing Trial option limit must be between 1 and 50'
OPTION_SEARCH_TOO_LONG_MESSAGE = (
    'Growing Trial option search must be 255 characters or fewer'
)


def _encode_cursor(trial_id: int) -> str:
    value = f'{GROWING_TRIAL_CURSOR_PREFIX}{trial_id}'.encode()
    return base64.b64encode(value).decode()


def _decode_cursor(cursor: str) -> int:
    try:
        value = base64.b64decode(cursor, validate=True).decode()
        trial_id = int(value.removeprefix(GROWING_TRIAL_CURSOR_PREFIX))
        if not value.startswith(GROWING_TRIAL_CURSOR_PREFIX) or trial_id <= 0:
            raise ValueError
    except (binascii.Error, UnicodeDecodeError, ValueError) as exc:
        raise ValueError(INVALID_GROWING_TRIAL_CURSOR_MESSAGE) from exc
    return trial_id


def _validate_option_inputs(search: str | None, limit: int, max_length: int) -> str:
    if limit < 1 or limit > MAX_GROWING_TRIALS_QUERY_LIMIT:
        raise ValueError(INVALID_OPTION_LIMIT_MESSAGE)
    search = search or ''
    if len(search) > max_length:
        raise ValueError(OPTION_SEARCH_TOO_LONG_MESSAGE)
    return search.strip()


@strawberry.type
class GrowingTrialPlantOption:
    id: strawberry.ID
    name: str


@strawberry.type
class GrowingTrialContainerOption:
    id: strawberry.ID
    name: str


@strawberry.type
class GrowingTrialPage:
    items: list[GrowingTrialType]
    has_next_page: bool
    has_previous_page: bool
    end_cursor: str | None


@strawberry.type
class GrowingTrialQueries:
    @strawberry.field
    def growing_trials(
        self,
        limit: int = DEFAULT_GROWING_TRIALS_QUERY_LIMIT,
        after: str | None = None,
        status: GrowingTrialStatusType | None = None,
    ) -> GrowingTrialPage:
        if limit < 1 or limit > MAX_GROWING_TRIALS_QUERY_LIMIT:
            raise ValueError(
                'Growing Trial query limit must be between '
                f'1 and {MAX_GROWING_TRIALS_QUERY_LIMIT}'
            )

        queryset = GrowingTrial.objects.select_related('plant', 'container')
        if status is not None:
            queryset = queryset.filter(status=status.value)
        if after is not None:
            queryset = queryset.filter(id__lt=_decode_cursor(after))
        queryset = queryset.order_by('-id')

        rows = list(queryset[: limit + 1])
        items = rows[:limit]

        return GrowingTrialPage(
            items=items,
            has_next_page=len(rows) > limit,
            has_previous_page=after is not None,
            end_cursor=_encode_cursor(items[-1].id) if items else None,
        )

    @strawberry.field
    def growing_trial_plant_options(
        self,
        search: str | None = None,
        limit: int = DEFAULT_GROWING_TRIALS_QUERY_LIMIT,
    ) -> list[GrowingTrialPlantOption]:
        search = _validate_option_inputs(search, limit, PLANT_NAME_MAX_LENGTH)
        queryset = Plant.objects.order_by(Lower('name'), 'id')
        if search:
            queryset = queryset.filter(name__icontains=search)
        return [
            GrowingTrialPlantOption(id=plant.id, name=plant.name)
            for plant in queryset[:limit]
        ]

    @strawberry.field
    def growing_trial_container_options(
        self,
        search: str | None = None,
        limit: int = DEFAULT_GROWING_TRIALS_QUERY_LIMIT,
    ) -> list[GrowingTrialContainerOption]:
        search = _validate_option_inputs(search, limit, CONTAINER_NAME_MAX_LENGTH)
        queryset = Container.objects.order_by(Lower('name'), 'id')
        if search:
            queryset = queryset.filter(name__icontains=search)
        return [
            GrowingTrialContainerOption(id=container.id, name=container.name)
            for container in queryset[:limit]
        ]
