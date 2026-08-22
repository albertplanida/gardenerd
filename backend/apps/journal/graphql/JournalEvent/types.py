import strawberry
import strawberry_django

from apps.growing_trials.graphql.GrowingTrial.types import GrowingTrialType
from apps.journal import models

JournalEventEventType = strawberry.enum(
    models.JournalEventEventType,
    name='JournalEventEventType',
)


@strawberry_django.type(models.JournalEvent)
class JournalEventType:
    id: strawberry.auto
    growing_trial: GrowingTrialType
    event_date: strawberry.auto
    note: strawberry.auto
    created_at: strawberry.auto
    updated_at: strawberry.auto

    @strawberry.field
    def event_type(self) -> JournalEventEventType:
        return JournalEventEventType(self.event_type)


@strawberry.type
class JournalEventPage:
    items: list[JournalEventType]
    has_next_page: bool
    end_cursor: str | None
