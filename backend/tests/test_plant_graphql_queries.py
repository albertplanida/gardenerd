import pytest

from apps.plants.graphql.Plant.queries import DEFAULT_PLANTS_QUERY_LIMIT
from apps.plants.models import Plant


@pytest.mark.django_db
def test_plants_query_returns_empty_list(client):
    response = client.post(
        '/graphql/',
        data={
            'query': """
                query Plants {
                    plants {
                        items {
                            id
                            name
                            careNotes
                            createdAt
                            updatedAt
                        }
                        hasNextPage
                        hasPreviousPage
                    }
                }
            """
        },
        content_type='application/json',
    )

    assert response.status_code == 200
    assert response.json()['data']['plants'] == {
        'items': [],
        'hasNextPage': False,
        'hasPreviousPage': False,
    }


@pytest.mark.django_db
def test_plants_query_returns_existing_plants_in_id_order(client):
    first = Plant.objects.create(name='Tomato', care_notes='Full sun')
    second = Plant.objects.create(name='Basil', care_notes='Keep moist')

    response = client.post(
        '/graphql/',
        data={
            'query': """
                query Plants {
                    plants {
                        items {
                            id
                            name
                            careNotes
                            createdAt
                            updatedAt
                        }
                        hasNextPage
                        hasPreviousPage
                    }
                }
            """
        },
        content_type='application/json',
    )

    assert response.status_code == 200
    assert response.json()['data']['plants'] == {
        'items': [
            {
                'id': str(first.id),
                'name': 'Tomato',
                'careNotes': 'Full sun',
                'createdAt': first.created_at.isoformat(),
                'updatedAt': first.updated_at.isoformat(),
            },
            {
                'id': str(second.id),
                'name': 'Basil',
                'careNotes': 'Keep moist',
                'createdAt': second.created_at.isoformat(),
                'updatedAt': second.updated_at.isoformat(),
            },
        ],
        'hasNextPage': False,
        'hasPreviousPage': False,
    }


@pytest.mark.django_db
def test_plants_query_default_page_is_bounded(client):
    plants = [Plant.objects.create(name=f'Plant {index}') for index in range(21)]

    response = client.post(
        '/graphql/',
        data={
            'query': """
                query Plants {
                    plants {
                        items {
                            id
                            name
                        }
                        hasNextPage
                        hasPreviousPage
                    }
                }
            """
        },
        content_type='application/json',
    )

    assert response.status_code == 200
    assert response.json()['data']['plants'] == {
        'items': [
            {'id': str(plant.id), 'name': plant.name}
            for plant in plants[:DEFAULT_PLANTS_QUERY_LIMIT]
        ],
        'hasNextPage': True,
        'hasPreviousPage': False,
    }


@pytest.mark.django_db
def test_plants_query_returns_requested_page_with_metadata(client):
    plants = [Plant.objects.create(name=f'Plant {index}') for index in range(5)]

    response = client.post(
        '/graphql/',
        data={
            'query': """
                query Plants($limit: Int!, $offset: Int!) {
                    plants(limit: $limit, offset: $offset) {
                        items {
                            id
                            name
                        }
                        hasNextPage
                        hasPreviousPage
                    }
                }
            """,
            'variables': {'limit': 2, 'offset': 2},
        },
        content_type='application/json',
    )

    assert response.status_code == 200
    assert response.json()['data']['plants'] == {
        'items': [
            {'id': str(plants[2].id), 'name': 'Plant 2'},
            {'id': str(plants[3].id), 'name': 'Plant 3'},
        ],
        'hasNextPage': True,
        'hasPreviousPage': True,
    }


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('variables', 'message'),
    [
        ({'limit': 0, 'offset': 0}, 'Plant query limit must be between 1 and 50'),
        ({'limit': 51, 'offset': 0}, 'Plant query limit must be between 1 and 50'),
        ({'limit': 20, 'offset': -1}, 'Plant query offset must be 0 or greater'),
    ],
)
def test_plants_query_rejects_invalid_pagination_arguments(
    client,
    variables,
    message,
):
    response = client.post(
        '/graphql/',
        data={
            'query': """
                query Plants($limit: Int!, $offset: Int!) {
                    plants(limit: $limit, offset: $offset) {
                        items {
                            id
                        }
                    }
                }
            """,
            'variables': variables,
        },
        content_type='application/json',
    )
    body = response.json()

    assert response.status_code == 200
    assert body['data'] is None
    assert body['errors'][0]['message'] == message
