import strawberry

from apps.growing_trials.graphql.GrowingTrial.types import GrowingTrialType
from apps.growing_trials.models import GrowingTrial

DEFAULT_GROWING_TRIALS_QUERY_LIMIT = 20
MAX_GROWING_TRIALS_QUERY_LIMIT = 50


@strawberry.type
class GrowingTrialPage:
    items: list[GrowingTrialType]
    has_next_page: bool
    has_previous_page: bool


@strawberry.type
class GrowingTrialQueries:
    @strawberry.field
    def growing_trials(
        self,
        limit: int = DEFAULT_GROWING_TRIALS_QUERY_LIMIT,
        offset: int = 0,
    ) -> GrowingTrialPage:
        if limit < 1 or limit > MAX_GROWING_TRIALS_QUERY_LIMIT:
            raise ValueError(
                'Growing Trial query limit must be between '
                f'1 and {MAX_GROWING_TRIALS_QUERY_LIMIT}'
            )

        if offset < 0:
            raise ValueError('Growing Trial query offset must be 0 or greater')

        rows = list(
            GrowingTrial.objects.select_related('plant', 'container').order_by('id')[
                offset : offset + limit + 1
            ]
        )

        return GrowingTrialPage(
            items=rows[:limit],
            has_next_page=len(rows) > limit,
            has_previous_page=offset > 0,
        )
