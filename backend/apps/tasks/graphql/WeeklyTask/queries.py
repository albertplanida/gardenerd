import logging

import strawberry
from graphql import GraphQLError

from apps.tasks.graphql.WeeklyTask.types import WeeklyTaskWeek
from apps.tasks.services import WeeklyTaskGenerationError, generate_weekly_tasks

logger = logging.getLogger(__name__)


@strawberry.type
class WeeklyTaskQueries:
    @strawberry.field
    def weekly_tasks(self, time_zone: str) -> WeeklyTaskWeek:
        try:
            week = generate_weekly_tasks(time_zone=time_zone)
        except WeeklyTaskGenerationError as exc:
            raise GraphQLError(str(exc), extensions={'code': exc.code}) from exc
        except Exception as exc:
            logger.exception('Unexpected error while generating weekly tasks')
            raise GraphQLError(
                'Internal server error.',
                extensions={'code': 'INTERNAL_ERROR'},
            ) from exc
        return WeeklyTaskWeek.from_value(week)
