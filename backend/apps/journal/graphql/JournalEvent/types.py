import strawberry
import strawberry_django

from apps.growing_trials.graphql.GrowingTrial.types import GrowingTrialType
from apps.journal import models
from apps.journal.photo_storage import photo_url

JournalEventEventType = strawberry.enum(
    models.JournalEventEventType,
    name='JournalEventEventType',
)


@strawberry_django.type(models.JournalPhoto)
class JournalPhotoType:
    id: strawberry.auto
    original_filename: strawberry.auto
    content_type: strawberry.auto
    file_size: strawberry.auto
    original_upload_size: strawberry.auto
    width: strawberry.auto
    height: strawberry.auto
    position: strawberry.auto
    created_at: strawberry.auto
    updated_at: strawberry.auto

    @strawberry.field
    def thumbnail_url(self) -> str:
        return photo_url(self.thumbnail_object_key)

    @strawberry.field
    def full_size_url(self) -> str:
        return photo_url(self.full_object_key)


@strawberry_django.type(models.JournalEvent)
class JournalEventType:
    id: strawberry.auto
    growing_trial: GrowingTrialType
    event_date: strawberry.auto
    note: strawberry.auto
    created_at: strawberry.auto
    updated_at: strawberry.auto
    photos: list[JournalPhotoType]

    @strawberry.field
    def event_type(self) -> JournalEventEventType:
        return JournalEventEventType(self.event_type)


@strawberry.type
class JournalEventPage:
    items: list[JournalEventType]
    has_next_page: bool
    end_cursor: str | None
