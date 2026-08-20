import base64
from datetime import UTC, date, datetime, timedelta

import pytest

from apps.containers.models import Container
from apps.growing_trials.models import (
    GrowingTrial,
    GrowingTrialStartMethod,
    GrowingTrialStatus,
)
from apps.journal.graphql.JournalEvent.queries import (
    INVALID_JOURNAL_EVENT_CURSOR_MESSAGE,
)
from apps.journal.models import JournalEvent, JournalEventEventType
from apps.plants.models import Plant


def _post_events(client, trial_id, variables=None):
    values = {'growingTrialId': str(trial_id)}
    values.update(variables or {})
    return client.post(
        '/graphql/',
        data={
            'query': """
                query JournalEvents(
                    $growingTrialId: ID!
                    $limit: Int
                    $after: String
                ) {
                    journalEvents(
                        growingTrialId: $growingTrialId
                        limit: $limit
                        after: $after
                    ) {
                        items {
                            id
                            growingTrial { id }
                            eventType
                            eventDate
                            note
                            createdAt
                            updatedAt
                        }
                        hasNextPage
                        hasPreviousPage
                        endCursor
                    }
                }
            """,
            'variables': values,
        },
        content_type='application/json',
    )


@pytest.fixture
def trial():
    return GrowingTrial.objects.create(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot 1'),
        status=GrowingTrialStatus.ACTIVE,
        start_date=date(2026, 8, 1),
        start_method=GrowingTrialStartMethod.SEED,
    )


@pytest.mark.django_db
@pytest.mark.parametrize('status', GrowingTrialStatus.values)
def test_timeline_reads_every_trial_status_and_empty_pages(client, trial, status):
    changes = {'status': status}
    if status == GrowingTrialStatus.PLANNED:
        changes.update(start_date=None, start_method=None)
    if status in [GrowingTrialStatus.COMPLETED, GrowingTrialStatus.ABANDONED]:
        changes['end_date'] = date(2026, 8, 2)
    GrowingTrial.objects.filter(pk=trial.pk).update(**changes)

    page = _post_events(client, trial.pk).json()['data']['journalEvents']

    assert page == {
        'items': [],
        'hasNextPage': False,
        'hasPreviousPage': False,
        'endCursor': None,
    }


@pytest.mark.django_db
def test_timeline_orders_and_paginates_all_ordering_keys(client, trial):
    events = [
        JournalEvent.objects.create(
            growing_trial=trial,
            event_type=JournalEventEventType.WATERED,
            event_date=date(2026, 8, 2) + timedelta(days=index // 2),
            note=f'Event {index}',
        )
        for index in range(4)
    ]
    tied_time = datetime(2026, 8, 5, 12, tzinfo=UTC)
    JournalEvent.objects.filter(pk__in=[events[2].pk, events[3].pk]).update(
        created_at=tied_time
    )

    first = _post_events(client, trial.pk, {'limit': 2}).json()['data']['journalEvents']
    second = _post_events(
        client, trial.pk, {'limit': 2, 'after': first['endCursor']}
    ).json()['data']['journalEvents']

    assert [item['id'] for item in first['items']] == [
        str(events[3].pk),
        str(events[2].pk),
    ]
    assert [item['id'] for item in second['items']] == [
        str(events[1].pk),
        str(events[0].pk),
    ]
    assert first['hasNextPage'] is True
    assert second['hasNextPage'] is False
    assert second['hasPreviousPage'] is True


@pytest.mark.django_db
@pytest.mark.parametrize('trial_id', ['999999', 'not-an-id'])
def test_timeline_returns_stable_not_found(client, trial_id):
    error = _post_events(client, trial_id).json()['errors'][0]

    assert error['message'] == 'Growing Trial not found.'
    assert error['extensions']['code'] == 'GROWING_TRIAL_NOT_FOUND'


@pytest.mark.django_db
@pytest.mark.parametrize('limit', [0, 51])
def test_timeline_rejects_out_of_range_limits(client, trial, limit):
    error = _post_events(client, trial.pk, {'limit': limit}).json()['errors'][0]

    assert error['message'] == 'Journal Event query limit must be between 1 and 50'


@pytest.mark.django_db
@pytest.mark.parametrize(
    'cursor',
    [
        'not base64!',
        base64.b64encode(b'journal-event:v2:[]').decode(),
        base64.b64encode(b'journal-event:v1:not-json').decode(),
        base64.b64encode(b'journal-event:v1:["2026-08-01","not-a-time",1]').decode(),
        base64.b64encode(
            b'journal-event:v1:["2026-08-01","2026-08-01T00:00:00+00:00",0]'
        ).decode(),
    ],
)
def test_timeline_rejects_malformed_and_wrong_version_cursors(client, trial, cursor):
    error = _post_events(client, trial.pk, {'after': cursor}).json()['errors'][0]

    assert error['message'] == INVALID_JOURNAL_EVENT_CURSOR_MESSAGE


@pytest.mark.django_db
def test_timeline_logs_and_masks_unexpected_errors(client, trial, monkeypatch, caplog):
    monkeypatch.setattr(
        'apps.journal.graphql.JournalEvent.queries.JournalEvent.objects.filter',
        lambda **kwargs: (_ for _ in ()).throw(RuntimeError('database secret')),
    )

    response = _post_events(client, trial.pk)
    error = response.json()['errors'][0]

    assert error['message'] == 'Internal server error.'
    assert error['extensions']['code'] == 'INTERNAL_ERROR'
    assert 'database secret' not in response.content.decode()
    assert 'database secret' in caplog.text
