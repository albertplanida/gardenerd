import pytest

from apps.containers.models import Container
from apps.growing_trials.graphql.GrowingTrial.queries import (
    DEFAULT_GROWING_TRIALS_QUERY_LIMIT,
)
from apps.growing_trials.models import GrowingTrial
from apps.plants.models import Plant


def _post_growing_trials(client, variables=None):
    return client.post(
        '/graphql/',
        data={
            'query': """
                query GrowingTrials($limit: Int, $offset: Int) {
                    growingTrials(limit: $limit, offset: $offset) {
                        items {
                            id
                            plant { id name }
                            container { id name }
                            status
                            createdAt
                            updatedAt
                        }
                        hasNextPage
                        hasPreviousPage
                    }
                }
            """,
            'variables': variables or {},
        },
        content_type='application/json',
    )


@pytest.mark.django_db
def test_growing_trials_query_returns_empty_page(client):
    response = _post_growing_trials(client)

    assert response.status_code == 200
    assert response.json()['data']['growingTrials'] == {
        'items': [],
        'hasNextPage': False,
        'hasPreviousPage': False,
    }


@pytest.mark.django_db
def test_growing_trials_query_returns_relationships_and_status_in_id_order(client):
    plant = Plant.objects.create(name='Radish')
    first_container = Container.objects.create(name='Pot 1')
    second_container = Container.objects.create(name='Pot 2')
    first = GrowingTrial.objects.create(plant=plant, container=first_container)
    second = GrowingTrial.objects.create(plant=plant, container=second_container)

    response = _post_growing_trials(client)

    assert response.status_code == 200
    assert response.json()['data']['growingTrials'] == {
        'items': [
            {
                'id': str(first.id),
                'plant': {'id': str(plant.id), 'name': 'Radish'},
                'container': {'id': str(first_container.id), 'name': 'Pot 1'},
                'status': 'PLANNED',
                'createdAt': first.created_at.isoformat(),
                'updatedAt': first.updated_at.isoformat(),
            },
            {
                'id': str(second.id),
                'plant': {'id': str(plant.id), 'name': 'Radish'},
                'container': {'id': str(second_container.id), 'name': 'Pot 2'},
                'status': 'PLANNED',
                'createdAt': second.created_at.isoformat(),
                'updatedAt': second.updated_at.isoformat(),
            },
        ],
        'hasNextPage': False,
        'hasPreviousPage': False,
    }


@pytest.mark.django_db
def test_growing_trials_query_default_page_is_bounded(client):
    plant = Plant.objects.create(name='Radish')
    trials = [
        GrowingTrial.objects.create(
            plant=plant,
            container=Container.objects.create(name=f'Pot {index}'),
        )
        for index in range(DEFAULT_GROWING_TRIALS_QUERY_LIMIT + 1)
    ]

    response = _post_growing_trials(client)
    page = response.json()['data']['growingTrials']

    assert response.status_code == 200
    assert [item['id'] for item in page['items']] == [
        str(trial.id) for trial in trials[:DEFAULT_GROWING_TRIALS_QUERY_LIMIT]
    ]
    assert page['hasNextPage'] is True
    assert page['hasPreviousPage'] is False


@pytest.mark.django_db
def test_growing_trials_query_returns_requested_page_metadata(client):
    plant = Plant.objects.create(name='Radish')
    trials = [
        GrowingTrial.objects.create(
            plant=plant,
            container=Container.objects.create(name=f'Pot {index}'),
        )
        for index in range(5)
    ]

    response = _post_growing_trials(client, {'limit': 2, 'offset': 2})
    page = response.json()['data']['growingTrials']

    assert [item['id'] for item in page['items']] == [
        str(trials[2].id),
        str(trials[3].id),
    ]
    assert page['hasNextPage'] is True
    assert page['hasPreviousPage'] is True


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('variables', 'message'),
    [
        (
            {'limit': 0, 'offset': 0},
            'Growing Trial query limit must be between 1 and 50',
        ),
        (
            {'limit': 51, 'offset': 0},
            'Growing Trial query limit must be between 1 and 50',
        ),
        (
            {'limit': 20, 'offset': -1},
            'Growing Trial query offset must be 0 or greater',
        ),
    ],
)
def test_growing_trials_query_rejects_invalid_pagination(
    client,
    variables,
    message,
):
    response = _post_growing_trials(client, variables)
    body = response.json()

    assert response.status_code == 200
    assert body['data'] is None
    assert body['errors'][0]['message'] == message
