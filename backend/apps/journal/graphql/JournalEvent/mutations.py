import datetime
import logging

import strawberry
from graphql import GraphQLError

from apps.journal.graphql.JournalEvent.types import (
    JournalEventEventType,
    JournalEventType,
)
from apps.journal.services import (
    JournalEventError,
    create_journal_event,
    delete_journal_event,
    update_journal_event,
)

logger = logging.getLogger(__name__)


def _run_journal_mutation(operation, action: str, record_id: strawberry.ID, **values):
    try:
        return operation(**values)
    except JournalEventError as exc:
        raise GraphQLError(str(exc), extensions={'code': exc.code}) from exc
    except Exception as exc:
        logger.exception(
            'Unexpected error while %s Journal Event %s', action, record_id
        )
        raise GraphQLError(
            'Internal server error.',
            extensions={'code': 'INTERNAL_ERROR'},
        ) from exc


@strawberry.type
class JournalEventMutations:
    @strawberry.mutation
    def create_journal_event(
        self,
        growing_trial_id: strawberry.ID,
        event_type: JournalEventEventType,
        event_date: datetime.date,
        note: str,
        time_zone: str,
    ) -> JournalEventType:
        return _run_journal_mutation(
            create_journal_event,
            'creating for',
            growing_trial_id,
            trial_id=growing_trial_id,
            event_type=event_type,
            event_date=event_date,
            note=note,
            time_zone=time_zone,
        )

    @strawberry.mutation
    def update_journal_event(
        self,
        id: strawberry.ID,
        event_type: JournalEventEventType,
        event_date: datetime.date,
        note: str,
        time_zone: str,
    ) -> JournalEventType:
        return _run_journal_mutation(
            update_journal_event,
            'updating',
            id,
            event_id=id,
            event_type=event_type,
            event_date=event_date,
            note=note,
            time_zone=time_zone,
        )

    @strawberry.mutation
    def delete_journal_event(self, id: strawberry.ID) -> strawberry.ID:
        return _run_journal_mutation(
            delete_journal_event,
            'deleting',
            id,
            event_id=id,
        )
