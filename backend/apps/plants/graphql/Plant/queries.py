import strawberry

from apps.plants.graphql.Plant.types import PlantType
from apps.plants.models import Plant

DEFAULT_PLANTS_QUERY_LIMIT = 20
MAX_PLANTS_QUERY_LIMIT = 50


@strawberry.type
class PlantPage:
    items: list[PlantType]
    has_next_page: bool
    has_previous_page: bool


@strawberry.type
class PlantQueries:
    @strawberry.field
    def plants(
        self,
        limit: int = DEFAULT_PLANTS_QUERY_LIMIT,
        offset: int = 0,
    ) -> PlantPage:
        if limit < 1 or limit > MAX_PLANTS_QUERY_LIMIT:
            raise ValueError(
                f'Plant query limit must be between 1 and {MAX_PLANTS_QUERY_LIMIT}'
            )

        if offset < 0:
            raise ValueError('Plant query offset must be 0 or greater')

        rows = list(Plant.objects.order_by('id')[offset : offset + limit + 1])

        return PlantPage(
            items=rows[:limit],
            has_next_page=len(rows) > limit,
            has_previous_page=offset > 0,
        )
