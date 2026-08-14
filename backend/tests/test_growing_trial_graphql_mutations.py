import pytest

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
