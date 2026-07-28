import pytest

from apps.containers.models import Container


@pytest.mark.django_db
def test_containers_query_returns_empty_list(client):
    response = client.post(
        '/graphql/',
        data={
            'query': """
                query Containers {
                    containers {
                        id
                        name
                        createdAt
                        updatedAt
                    }
                }
            """
        },
        content_type='application/json',
    )

    assert response.status_code == 200
    assert response.json()['data']['containers'] == []


@pytest.mark.django_db
def test_containers_query_returns_existing_containers_in_id_order(client):
    first = Container.objects.create(name='Pot 1')
    second = Container.objects.create(name='Pot 2')

    response = client.post(
        '/graphql/',
        data={
            'query': """
                query Containers {
                    containers {
                        id
                        name
                        createdAt
                        updatedAt
                    }
                }
            """
        },
        content_type='application/json',
    )

    assert response.status_code == 200
    assert response.json()['data']['containers'] == [
        {
            'id': str(first.id),
            'name': 'Pot 1',
            'createdAt': first.created_at.isoformat(),
            'updatedAt': first.updated_at.isoformat(),
        },
        {
            'id': str(second.id),
            'name': 'Pot 2',
            'createdAt': second.created_at.isoformat(),
            'updatedAt': second.updated_at.isoformat(),
        },
    ]
