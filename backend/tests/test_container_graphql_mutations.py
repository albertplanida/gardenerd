import pytest

from apps.containers.models import Container


@pytest.mark.django_db
def test_create_container_mutation_creates_and_returns_container(client):
    response = client.post(
        '/graphql/',
        data={
            'query': '''
                mutation CreateContainer($name: String!) {
                    createContainer(name: $name) {
                        id
                        name
                        createdAt
                        updatedAt
                    }
                }
            ''',
            'variables': {'name': 'Pot 1'},
        },
        content_type='application/json',
    )

    container = Container.objects.get()

    assert response.status_code == 200
    assert response.json()['data']['createContainer'] == {
        'id': str(container.id),
        'name': 'Pot 1',
        'createdAt': container.created_at.isoformat(),
        'updatedAt': container.updated_at.isoformat(),
    }


@pytest.mark.django_db
def test_edit_container_mutation_updates_and_returns_container(client):
    container = Container.objects.create(name='Pot 1')

    response = client.post(
        '/graphql/',
        data={
            'query': '''
                mutation EditContainer($id: ID!, $name: String!) {
                    editContainer(id: $id, name: $name) {
                        id
                        name
                        createdAt
                        updatedAt
                    }
                }
            ''',
            'variables': {'id': str(container.id), 'name': 'Updated Pot'},
        },
        content_type='application/json',
    )

    container.refresh_from_db()

    assert response.status_code == 200
    assert response.json()['data']['editContainer'] == {
        'id': str(container.id),
        'name': 'Updated Pot',
        'createdAt': container.created_at.isoformat(),
        'updatedAt': container.updated_at.isoformat(),
    }
    assert container.name == 'Updated Pot'


@pytest.mark.django_db
def test_edit_container_mutation_returns_clean_error_for_missing_container(client):
    response = client.post(
        '/graphql/',
        data={
            'query': '''
                mutation EditContainer($id: ID!, $name: String!) {
                    editContainer(id: $id, name: $name) {
                        id
                        name
                    }
                }
            ''',
            'variables': {'id': '999', 'name': 'Updated Pot'},
        },
        content_type='application/json',
    )

    body = response.json()

    assert response.status_code == 200
    assert body['data'] is None
    assert body['errors'][0]['message'] == 'Container not found'
