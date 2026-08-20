import base64
import binascii
import json
import logging
from datetime import date, datetime

import strawberry
from django.core.exceptions import ValidationError
from django.db.models import Q
from graphql import GraphQLError

from apps.growing_trials.models import GrowingTrial
from apps.journal.graphql.JournalEvent.types import JournalEventPage
from apps.journal.models import JournalEvent

DEFAULT_JOURNAL_EVENTS_QUERY_LIMIT = 20
MAX_JOURNAL_EVENTS_QUERY_LIMIT = 50
JOURNAL_EVENT_CURSOR_PREFIX = 'journal-event:v1:'
INVALID_JOURNAL_EVENT_CURSOR_MESSAGE = 'Invalid Journal Event cursor'
logger = logging.getLogger(__name__)


class JournalEventQueryError(ValueError):
    pass


def _encode_cursor(event: JournalEvent) -> str:
    keys = json.dumps(
        [event.event_date.isoformat(), event.created_at.isoformat(), event.pk],
        separators=(',', ':'),
    )
    value = f'{JOURNAL_EVENT_CURSOR_PREFIX}{keys}'.encode()
    return base64.b64encode(value).decode()


def _decode_cursor(cursor: str) -> tuple[date, datetime, int]:
    try:
        value = base64.b64decode(cursor, validate=True).decode()
        if not value.startswith(JOURNAL_EVENT_CURSOR_PREFIX):
            raise ValueError
        keys = json.loads(value.removeprefix(JOURNAL_EVENT_CURSOR_PREFIX))
        if not isinstance(keys, list) or len(keys) != 3:
            raise ValueError
        event_date_value, created_at_value, event_id_value = keys
        event_date = date.fromisoformat(event_date_value)
        created_at = datetime.fromisoformat(created_at_value)
        if type(event_id_value) is not int:
            raise ValueError
        event_id = event_id_value
        if (
            event_date.isoformat() != event_date_value
            or created_at.isoformat() != created_at_value
            or created_at.tzinfo is None
            or event_id <= 0
        ):
            raise ValueError
    except (
        binascii.Error,
        json.JSONDecodeError,
        TypeError,
        UnicodeDecodeError,
        ValueError,
    ) as exc:
        raise JournalEventQueryError(INVALID_JOURNAL_EVENT_CURSOR_MESSAGE) from exc
    return event_date, created_at, event_id


def _get_trial(trial_id: object) -> GrowingTrial:
    try:
        return GrowingTrial.objects.get(pk=trial_id)
    except (
        GrowingTrial.DoesNotExist,
        TypeError,
        ValueError,
        ValidationError,
    ) as exc:
        raise GraphQLError(
            'Growing Trial not found.',
            extensions={'code': 'GROWING_TRIAL_NOT_FOUND'},
        ) from exc


@strawberry.type
class JournalEventQueries:
    @strawberry.field
    def journal_events(
        self,
        growing_trial_id: strawberry.ID,
        limit: int = DEFAULT_JOURNAL_EVENTS_QUERY_LIMIT,
        after: str | None = None,
    ) -> JournalEventPage:
        try:
            return _journal_event_page(growing_trial_id, limit, after)
        except (GraphQLError, JournalEventQueryError):
            raise
        except Exception as exc:
            logger.exception(
                'Unexpected error while listing Journal Events for Growing Trial %s',
                growing_trial_id,
            )
            raise GraphQLError(
                'Internal server error.',
                extensions={'code': 'INTERNAL_ERROR'},
            ) from exc


def _journal_event_page(
    growing_trial_id: object,
    limit: int,
    after: str | None,
) -> JournalEventPage:
    if limit < 1 or limit > MAX_JOURNAL_EVENTS_QUERY_LIMIT:
        raise JournalEventQueryError(
            'Journal Event query limit must be between 1 and 50'
        )

    trial = _get_trial(growing_trial_id)
    queryset = (
        JournalEvent.objects.filter(growing_trial=trial)
        .select_related(
            'growing_trial',
            'growing_trial__plant',
            'growing_trial__container',
        )
        .order_by('-event_date', '-created_at', '-id')
    )
    if after is not None:
        event_date, created_at, event_id = _decode_cursor(after)
        queryset = queryset.filter(
            Q(event_date__lt=event_date)
            | Q(event_date=event_date, created_at__lt=created_at)
            | Q(
                event_date=event_date,
                created_at=created_at,
                id__lt=event_id,
            )
        )

    rows = list(queryset[: limit + 1])
    items = rows[:limit]
    return JournalEventPage(
        items=items,
        has_next_page=len(rows) > limit,
        has_previous_page=after is not None,
        end_cursor=_encode_cursor(items[-1]) if items else None,
    )
