from datetime import timedelta

import pytest
from django.utils import timezone

from apps.containers.models import Container
from apps.growing_trials.models import (
    GrowingTrial,
    GrowingTrialStartMethod,
    GrowingTrialStatus,
)
from apps.journal.models import JournalEvent, JournalEventEventType
from apps.plants.models import Plant


def _post_create_growing_trial(client, plant_id, container_id):
    return client.post(
        '/graphql/',
        data={
            'query': """
                mutation CreateGrowingTrial($plantId: ID!, $containerId: ID!) {
                    createGrowingTrial(
                        plantId: $plantId
                        containerId: $containerId
                    ) {
                        id
                        plant { id name }
                        container { id name }
                        status
                        createdAt
                        updatedAt
                    }
                }
            """,
            'variables': {
                'plantId': str(plant_id),
                'containerId': str(container_id),
            },
        },
        content_type='application/json',
    )


def _post_start_growing_trial(client, trial_id, **variables):
    values = {
        'id': str(trial_id),
        'startDate': timezone.localdate().isoformat(),
        'startMethod': 'SEED',
        'timeZone': 'UTC',
    }
    values.update(variables)
    return client.post(
        '/graphql/',
        data={
            'query': """
                mutation StartGrowingTrial(
                    $id: ID!
                    $startDate: Date!
                    $startMethod: GrowingTrialStartMethod!
                    $timeZone: String!
                ) {
                    startGrowingTrial(
                        id: $id
                        startDate: $startDate
                        startMethod: $startMethod
                        timeZone: $timeZone
                    ) {
                        id
                        plant { id name }
                        container { id name }
                        status
                        startDate
                        startMethod
                        createdAt
                        updatedAt
                    }
                }
            """,
            'variables': values,
        },
        content_type='application/json',
    )


def _post_terminal_mutation(client, mutation, trial_id, **variables):
    values = {
        'id': str(trial_id),
        'endDate': timezone.localdate().isoformat(),
        'resultSummary': None,
        'timeZone': 'UTC',
    }
    values.update(variables)
    return client.post(
        '/graphql/',
        data={
            'query': f"""
                mutation TerminalGrowingTrial(
                    $id: ID!
                    $endDate: Date!
                    $resultSummary: String
                    $timeZone: String!
                ) {{
                    {mutation}(
                        id: $id
                        endDate: $endDate
                        resultSummary: $resultSummary
                        timeZone: $timeZone
                    ) {{
                        id
                        plant {{ id name }}
                        container {{ id name }}
                        status
                        startDate
                        startMethod
                        endDate
                        resultSummary
                        createdAt
                        updatedAt
                    }}
                }}
            """,
            'variables': values,
        },
        content_type='application/json',
    )


@pytest.mark.django_db
def test_create_growing_trial_mutation_creates_planned_trial(client):
    plant = Plant.objects.create(name='Radish')
    container = Container.objects.create(name='Pot 1')

    response = _post_create_growing_trial(client, plant.id, container.id)
    trial = GrowingTrial.objects.get()

    assert response.status_code == 200
    assert response.json()['data']['createGrowingTrial'] == {
        'id': str(trial.id),
        'plant': {'id': str(plant.id), 'name': 'Radish'},
        'container': {'id': str(container.id), 'name': 'Pot 1'},
        'status': 'PLANNED',
        'createdAt': trial.created_at.isoformat(),
        'updatedAt': trial.updated_at.isoformat(),
    }
    assert trial.status == GrowingTrialStatus.PLANNED


@pytest.mark.django_db
@pytest.mark.parametrize('plant_id', ['999', 'not-an-id'])
def test_create_growing_trial_mutation_returns_safe_error_for_invalid_plant(
    client,
    plant_id,
):
    container = Container.objects.create(name='Pot 1')

    response = _post_create_growing_trial(client, plant_id, container.id)
    body = response.json()

    assert response.status_code == 200
    assert body['data'] is None
    assert body['errors'][0]['message'] == 'Plant not found'
    assert GrowingTrial.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize('container_id', ['999', 'not-an-id'])
def test_create_growing_trial_mutation_returns_safe_error_for_invalid_container(
    client,
    container_id,
):
    plant = Plant.objects.create(name='Radish')

    response = _post_create_growing_trial(client, plant.id, container_id)
    body = response.json()

    assert response.status_code == 200
    assert body['data'] is None
    assert body['errors'][0]['message'] == 'Container not found'
    assert GrowingTrial.objects.count() == 0


@pytest.mark.django_db
def test_create_growing_trial_mutation_does_not_accept_initial_status(client):
    plant = Plant.objects.create(name='Radish')
    container = Container.objects.create(name='Pot 1')

    response = client.post(
        '/graphql/',
        data={
            'query': """
                mutation CreateGrowingTrial(
                    $plantId: ID!
                    $containerId: ID!
                    $status: GrowingTrialStatusType!
                ) {
                    createGrowingTrial(
                        plantId: $plantId
                        containerId: $containerId
                        status: $status
                    ) { id }
                }
            """,
            'variables': {
                'plantId': str(plant.id),
                'containerId': str(container.id),
                'status': 'PLANNED',
            },
        },
        content_type='application/json',
    )

    assert response.status_code == 200
    assert response.json()['data'] is None
    assert "Unknown argument 'status'" in response.json()['errors'][0]['message']
    assert GrowingTrial.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize('start_method', ['SEED', 'SEEDLING_TRANSPLANT'])
def test_start_growing_trial_returns_complete_updated_card(client, start_method):
    plant = Plant.objects.create(name='Radish')
    container = Container.objects.create(name='Pot 1')
    trial = GrowingTrial.objects.create_planned(plant=plant, container=container)

    response = _post_start_growing_trial(
        client,
        trial.id,
        startMethod=start_method,
    )
    trial.refresh_from_db()

    assert response.status_code == 200
    assert response.json()['data']['startGrowingTrial'] == {
        'id': str(trial.id),
        'plant': {'id': str(plant.id), 'name': 'Radish'},
        'container': {'id': str(container.id), 'name': 'Pot 1'},
        'status': 'ACTIVE',
        'startDate': timezone.localdate().isoformat(),
        'startMethod': start_method,
        'createdAt': trial.created_at.isoformat(),
        'updatedAt': trial.updated_at.isoformat(),
    }


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('variables', 'prepare', 'code', 'message'),
    [
        (
            {'id': 'not-an-id'},
            None,
            'GROWING_TRIAL_NOT_FOUND',
            'Growing Trial not found.',
        ),
        (
            {'startDate': '2999-01-01'},
            None,
            'START_DATE_IN_FUTURE',
            'Start date cannot be in the future.',
        ),
        (
            {'timeZone': 'Invalid/Zone'},
            None,
            'INVALID_TIME_ZONE',
            'Browser time zone is invalid; refresh and try again.',
        ),
        (
            {},
            'active',
            'GROWING_TRIAL_NOT_PLANNED',
            'Only planned Growing Trials can be started.',
        ),
        (
            {},
            'occupied',
            'CONTAINER_OCCUPIED',
            'This Container already has an active Growing Trial.',
        ),
    ],
)
def test_start_growing_trial_returns_stable_domain_errors(
    client,
    variables,
    prepare,
    code,
    message,
):
    plant = Plant.objects.create(name='Radish')
    container = Container.objects.create(name='Pot 1')
    trial = GrowingTrial.objects.create_planned(plant=plant, container=container)
    if prepare == 'active':
        GrowingTrial.objects.filter(pk=trial.pk).update(
            status=GrowingTrialStatus.ACTIVE,
            start_date=timezone.localdate(),
            start_method='seed',
        )
    elif prepare == 'occupied':
        occupying = GrowingTrial.objects.create_planned(
            plant=plant,
            container=container,
        )
        _post_start_growing_trial(client, occupying.pk)

    response = _post_start_growing_trial(client, trial.pk, **variables)
    error = response.json()['errors'][0]

    assert error['message'] == message
    assert error['extensions']['code'] == code


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('variable', 'value', 'message_fragment'),
    [
        ('startDate', 'not-a-date', 'Value cannot represent a Date'),
        ('startMethod', 'CUTTING', 'does not exist in'),
    ],
)
def test_start_growing_trial_rejects_malformed_graphql_inputs(
    client,
    variable,
    value,
    message_fragment,
):
    trial = GrowingTrial.objects.create_planned(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot 1'),
    )

    response = _post_start_growing_trial(client, trial.pk, **{variable: value})

    assert message_fragment in response.json()['errors'][0]['message']
    trial.refresh_from_db()
    assert trial.status == GrowingTrialStatus.PLANNED


@pytest.mark.django_db
def test_start_growing_trial_logs_and_masks_unexpected_errors(
    client, monkeypatch, caplog
):
    trial = GrowingTrial.objects.create_planned(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot 1'),
    )
    monkeypatch.setattr(
        'apps.growing_trials.graphql.GrowingTrial.mutations.start_growing_trial',
        lambda **kwargs: (_ for _ in ()).throw(RuntimeError('database secret')),
    )

    response = _post_start_growing_trial(client, trial.pk)
    error = response.json()['errors'][0]

    assert error['message'] == 'Internal server error.'
    assert error['extensions']['code'] == 'INTERNAL_ERROR'
    assert 'database secret' not in response.content.decode()
    assert 'database secret' in caplog.text


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('mutation', 'initial_status', 'expected_status'),
    [
        ('completeGrowingTrial', 'active', 'COMPLETED'),
        ('abandonGrowingTrial', 'active', 'ABANDONED'),
        ('abandonGrowingTrial', 'planned', 'ABANDONED'),
    ],
)
def test_terminal_mutations_return_complete_updated_card(
    client,
    mutation,
    initial_status,
    expected_status,
):
    plant = Plant.objects.create(name='Radish')
    container = Container.objects.create(name='Pot 1')
    trial = GrowingTrial.objects.create_planned(plant=plant, container=container)
    if initial_status == 'active':
        _post_start_growing_trial(
            client,
            trial.pk,
            startDate='2026-08-01',
        )

    response = _post_terminal_mutation(
        client,
        mutation,
        trial.pk,
        resultSummary='  Good result.  ',
    )
    trial.refresh_from_db()

    assert response.status_code == 200
    assert response.json()['data'][mutation] == {
        'id': str(trial.id),
        'plant': {'id': str(plant.id), 'name': 'Radish'},
        'container': {'id': str(container.id), 'name': 'Pot 1'},
        'status': expected_status,
        'startDate': '2026-08-01' if initial_status == 'active' else None,
        'startMethod': 'SEED' if initial_status == 'active' else None,
        'endDate': timezone.localdate().isoformat(),
        'resultSummary': 'Good result.',
        'createdAt': trial.created_at.isoformat(),
        'updatedAt': trial.updated_at.isoformat(),
    }


@pytest.mark.django_db
@pytest.mark.parametrize('status', ['completed', 'abandoned'])
def test_update_growing_trial_result_returns_status_unchanged(client, status):
    trial = GrowingTrial.objects.create_planned(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot 1'),
    )
    if status == 'completed':
        _post_start_growing_trial(client, trial.pk, startDate='2026-08-01')
        _post_terminal_mutation(client, 'completeGrowingTrial', trial.pk)
    else:
        _post_terminal_mutation(client, 'abandonGrowingTrial', trial.pk)

    response = _post_terminal_mutation(
        client,
        'updateGrowingTrialResult',
        trial.pk,
        endDate='2026-08-02',
        resultSummary='Revised',
    )

    result = response.json()['data']['updateGrowingTrialResult']
    assert result['status'] == status.upper()
    assert result['endDate'] == '2026-08-02'
    assert result['resultSummary'] == 'Revised'


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('mutation', 'prepare', 'variables', 'code', 'message'),
    [
        (
            'completeGrowingTrial',
            'planned',
            {},
            'GROWING_TRIAL_NOT_ACTIVE',
            'Only active Growing Trials can be completed.',
        ),
        (
            'abandonGrowingTrial',
            'terminal',
            {},
            'GROWING_TRIAL_NOT_ENDABLE',
            'Only planned or active Growing Trials can be abandoned.',
        ),
        (
            'updateGrowingTrialResult',
            'planned',
            {},
            'GROWING_TRIAL_NOT_TERMINAL',
            'Only completed or abandoned Growing Trials can be edited.',
        ),
        (
            'abandonGrowingTrial',
            'planned',
            {'id': 'not-an-id'},
            'GROWING_TRIAL_NOT_FOUND',
            'Growing Trial not found.',
        ),
        (
            'abandonGrowingTrial',
            'planned',
            {'endDate': '2999-01-01'},
            'END_DATE_IN_FUTURE',
            'End date cannot be in the future.',
        ),
        (
            'completeGrowingTrial',
            'active',
            {'endDate': '2026-07-31'},
            'END_DATE_BEFORE_START',
            'End date cannot be before the start date.',
        ),
        (
            'abandonGrowingTrial',
            'planned',
            {'timeZone': 'Invalid/Zone'},
            'INVALID_TIME_ZONE',
            'Browser time zone is invalid; refresh and try again.',
        ),
        (
            'abandonGrowingTrial',
            'planned',
            {'resultSummary': 'x' * 5001},
            'INVALID_RESULT_SUMMARY',
            'Result summary cannot exceed 5,000 characters.',
        ),
    ],
)
def test_terminal_mutations_return_stable_domain_errors(
    client,
    mutation,
    prepare,
    variables,
    code,
    message,
):
    trial = GrowingTrial.objects.create_planned(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot 1'),
    )
    if prepare == 'active':
        _post_start_growing_trial(client, trial.pk, startDate='2026-08-01')
    elif prepare == 'terminal':
        _post_terminal_mutation(client, 'abandonGrowingTrial', trial.pk)

    response = _post_terminal_mutation(client, mutation, trial.pk, **variables)
    error = response.json()['errors'][0]

    assert error['message'] == message
    assert error['extensions']['code'] == code


@pytest.mark.django_db
@pytest.mark.parametrize(
    'mutation',
    [
        'completeGrowingTrial',
        'abandonGrowingTrial',
        'updateGrowingTrialResult',
    ],
)
def test_terminal_mutations_reject_end_date_before_latest_journal_event(
    client,
    mutation,
):
    today = timezone.localdate()
    trial = GrowingTrial.objects.create(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot 1'),
        status=GrowingTrialStatus.ACTIVE,
        start_date=today - timedelta(days=2),
        start_method=GrowingTrialStartMethod.SEED,
    )
    JournalEvent.objects.create(
        growing_trial=trial,
        event_type=JournalEventEventType.WATERED,
        event_date=today,
        note='Watered',
    )
    if mutation == 'updateGrowingTrialResult':
        GrowingTrial.objects.filter(pk=trial.pk).update(
            status=GrowingTrialStatus.COMPLETED,
            end_date=today,
        )

    response = _post_terminal_mutation(
        client,
        mutation,
        trial.pk,
        endDate=(today - timedelta(days=1)).isoformat(),
    )
    error = response.json()['errors'][0]

    assert error['message'] == 'End date cannot be before the latest Journal Event.'
    assert error['extensions']['code'] == 'END_DATE_BEFORE_LATEST_JOURNAL_EVENT'


@pytest.mark.django_db
def test_update_growing_trial_result_does_not_accept_status(client):
    trial = GrowingTrial.objects.create_planned(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot 1'),
    )

    response = client.post(
        '/graphql/',
        data={
            'query': """
                mutation UpdateGrowingTrialResult(
                    $id: ID!
                    $endDate: Date!
                    $timeZone: String!
                    $status: GrowingTrialStatusType!
                ) {
                    updateGrowingTrialResult(
                        id: $id
                        endDate: $endDate
                        timeZone: $timeZone
                        status: $status
                    ) { id }
                }
            """,
            'variables': {
                'id': str(trial.pk),
                'endDate': timezone.localdate().isoformat(),
                'timeZone': 'UTC',
                'status': 'COMPLETED',
            },
        },
        content_type='application/json',
    )

    assert "Unknown argument 'status'" in response.json()['errors'][0]['message']


@pytest.mark.django_db
@pytest.mark.parametrize('mutation', ['completeGrowingTrial', 'abandonGrowingTrial'])
def test_terminal_mutations_reject_malformed_date(client, mutation):
    trial = GrowingTrial.objects.create_planned(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot 1'),
    )

    response = _post_terminal_mutation(
        client,
        mutation,
        trial.pk,
        endDate='not-a-date',
    )

    assert 'Value cannot represent a Date' in response.json()['errors'][0]['message']


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('mutation', 'service_name'),
    [
        ('completeGrowingTrial', 'complete_growing_trial'),
        ('abandonGrowingTrial', 'abandon_growing_trial'),
        ('updateGrowingTrialResult', 'update_growing_trial_result'),
    ],
)
def test_terminal_mutations_log_and_mask_unexpected_errors(
    client,
    monkeypatch,
    caplog,
    mutation,
    service_name,
):
    trial = GrowingTrial.objects.create_planned(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot 1'),
    )
    monkeypatch.setattr(
        f'apps.growing_trials.graphql.GrowingTrial.mutations.{service_name}',
        lambda **kwargs: (_ for _ in ()).throw(RuntimeError('database secret')),
    )

    response = _post_terminal_mutation(client, mutation, trial.pk)
    error = response.json()['errors'][0]

    assert error['message'] == 'Internal server error.'
    assert error['extensions']['code'] == 'INTERNAL_ERROR'
    assert 'database secret' not in response.content.decode()
    assert 'database secret' in caplog.text
