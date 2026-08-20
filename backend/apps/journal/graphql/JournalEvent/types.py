from enum import Enum

import strawberry
import strawberry_django

from apps.growing_trials.graphql.GrowingTrial.types import GrowingTrialType
from apps.journal.models import JournalEvent


@strawberry.enum
class JournalEventEventType(Enum):
    PLANTED = 'planted'
    WATERED = 'watered'
    GERMINATED = 'germinated'
    FERTILIZED = 'fertilized'
    PRUNED = 'pruned'
    HARVESTED = 'harvested'
    PROBLEM_NOTICED = 'problem_noticed'
    PHOTO_TAKEN = 'photo_taken'
    GENERAL_OBSERVATION = 'general_observation'


@strawberry_django.type(JournalEvent)
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
    has_previous_page: bool
    end_cursor: str | None
