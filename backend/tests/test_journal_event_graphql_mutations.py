from datetime import date, timedelta

import pytest

from apps.containers.models import Container
from apps.growing_trials.models import (
    GrowingTrial,
    GrowingTrialStartMethod,
    GrowingTrialStatus,
)
from apps.journal.models import JournalEvent, JournalEventEventType
from apps.plants.models import Plant


def _post_mutation(client, mutation, variables):
    declarations = {
        'createJournalEvent': '$growingTrialId: ID!, ',
        'updateJournalEvent': '$id: ID!, ',
    }
    identifiers = {
        'createJournalEvent': 'growingTrialId: $growingTrialId, ',
        'updateJournalEvent': 'id: $id, ',
    }
    return client.post(
        '/graphql/',
        data={
            'query': f"""
                mutation JournalMutation(
                    {declarations[mutation]}
                    $eventType: JournalEventEventType!
                    $eventDate: Date!
                    $note: String!
                    $timeZone: String!
                ) {{
                    {mutation}(
                        {identifiers[mutation]}
                        eventType: $eventType
                        eventDate: $eventDate
                        note: $note
                        timeZone: $timeZone
                    ) {{
                        id
                        growingTrial {{ id }}
                        eventType
                        eventDate
                        note
                        createdAt
                        updatedAt
                    }}
                }}
            """,
            'variables': variables,
        },
        content_type='application/json',
    )


def _post_delete(client, event_id):
    return client.post(
        '/graphql/',
        data={
            'query': """
                mutation DeleteJournalEvent($id: ID!) {
                    deleteJournalEvent(id: $id)
                }
            """,
            'variables': {'id': str(event_id)},
        },
        content_type='application/json',
    )


@pytest.fixture
def trial():
    return GrowingTrial.objects.create(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot 1'),
        status=GrowingTrialStatus.ACTIVE,
        start_date=date.today() - timedelta(days=1),
        start_method=GrowingTrialStartMethod.SEED,
    )


def _variables(trial, **overrides):
    values = {
        'growingTrialId': str(trial.pk),
        'eventType': 'WATERED',
        'eventDate': date.today().isoformat(),
        'note': '  Watered well  ',
        'timeZone': 'UTC',
    }
    values.update(overrides)
    return values


@pytest.mark.django_db
@pytest.mark.parametrize('event_type', JournalEventEventType.names)
def test_create_round_trips_every_explicit_event_type(client, trial, event_type):
    response = _post_mutation(
        client,
        'createJournalEvent',
        _variables(trial, eventType=event_type),
    )
    result = response.json()['data']['createJournalEvent']
    event = JournalEvent.objects.get(pk=result['id'])

    assert result['growingTrial'] == {'id': str(trial.pk)}
    assert result['eventType'] == event_type
    assert result['eventDate'] == date.today().isoformat()
    assert result['note'] == 'Watered well'
    assert result['createdAt'] == event.created_at.isoformat()
    assert result['updatedAt'] == event.updated_at.isoformat()


@pytest.mark.django_db
def test_invalid_event_type_is_rejected_before_service(client, trial, monkeypatch):
    service_called = False

    def unexpected_service(**kwargs):
        nonlocal service_called
        service_called = True

    monkeypatch.setattr(
        'apps.journal.graphql.JournalEvent.mutations.create_journal_event',
        unexpected_service,
    )

    response = _post_mutation(
        client,
        'createJournalEvent',
        _variables(trial, eventType='UNSUPPORTED'),
    )

    assert response.json()['data'] is None
    assert 'does not exist in' in response.json()['errors'][0]['message']
    assert service_called is False


@pytest.mark.django_db
def test_update_and_delete_return_complete_results(client, trial):
    event = JournalEvent.objects.create(
        growing_trial=trial,
        event_type=JournalEventEventType.WATERED,
        event_date=date.today(),
        note='Original',
    )
    response = _post_mutation(
        client,
        'updateJournalEvent',
        _variables(trial, id=str(event.pk), eventType='PRUNED', note='Updated'),
    )

    assert response.json()['data']['updateJournalEvent']['eventType'] == 'PRUNED'
    assert response.json()['data']['updateJournalEvent']['note'] == 'Updated'
    assert _post_delete(client, event.pk).json()['data']['deleteJournalEvent'] == str(
        event.pk
    )
    assert not JournalEvent.objects.filter(pk=event.pk).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('mutation', 'variables', 'code', 'message'),
    [
        (
            'createJournalEvent',
            {'growingTrialId': 'missing'},
            'GROWING_TRIAL_NOT_FOUND',
            'Growing Trial not found.',
        ),
        (
            'createJournalEvent',
            {'note': '  '},
            'INVALID_JOURNAL_NOTE',
            'Note is required and cannot exceed 5,000 characters.',
        ),
        (
            'createJournalEvent',
            {'timeZone': 'Invalid/Zone'},
            'INVALID_TIME_ZONE',
            'Browser time zone is invalid; refresh and try again.',
        ),
    ],
)
def test_mutations_expose_stable_domain_errors(
    client, trial, mutation, variables, code, message
):
    response = _post_mutation(client, mutation, _variables(trial, **variables))
    error = response.json()['errors'][0]

    assert error['message'] == message
    assert error['extensions']['code'] == code


@pytest.mark.django_db
def test_update_and_delete_invalid_ids_use_event_not_found(client, trial):
    update_error = _post_mutation(
        client,
        'updateJournalEvent',
        _variables(trial, id='not-an-id'),
    ).json()['errors'][0]
    delete_error = _post_delete(client, 'not-an-id').json()['errors'][0]

    for error in [update_error, delete_error]:
        assert error['message'] == 'Journal Event not found.'
        assert error['extensions']['code'] == 'JOURNAL_EVENT_NOT_FOUND'


@pytest.mark.django_db
def test_create_logs_and_masks_unexpected_errors(client, trial, monkeypatch, caplog):
    monkeypatch.setattr(
        'apps.journal.graphql.JournalEvent.mutations.create_journal_event',
        lambda **kwargs: (_ for _ in ()).throw(RuntimeError('database secret')),
    )

    response = _post_mutation(client, 'createJournalEvent', _variables(trial))
    error = response.json()['errors'][0]

    assert error['message'] == 'Internal server error.'
    assert error['extensions']['code'] == 'INTERNAL_ERROR'
    assert 'database secret' not in response.content.decode()
    assert 'database secret' in caplog.text
