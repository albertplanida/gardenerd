import pytest
from django.utils import timezone

from apps.containers.models import Container
from apps.growing_trials.models import GrowingTrial, GrowingTrialStatus
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
def test_start_growing_trial_masks_unexpected_errors(client, monkeypatch):
    trial = GrowingTrial.objects.create_planned(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot 1'),
    )
    monkeypatch.setattr(
        'apps.growing_trials.graphql.GrowingTrial.mutations.start_growing_trial',
        lambda **kwargs: (_ for _ in ()).throw(RuntimeError('database secret')),
    )

    error = _post_start_growing_trial(client, trial.pk).json()['errors'][0]

    assert error['message'] == 'Internal server error.'
    assert error['extensions']['code'] == 'INTERNAL_ERROR'
    assert 'database secret' not in str(error)
