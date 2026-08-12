import pytest

from apps.plants.models import Plant


@pytest.mark.django_db
def test_create_plant_mutation_creates_and_returns_plant(client):
    response = client.post(
        '/graphql/',
        data={
            'query': """
                mutation CreatePlant($name: String!, $careNotes: String!) {
                    createPlant(name: $name, careNotes: $careNotes) {
                        id
                        name
                        careNotes
                        createdAt
                        updatedAt
                    }
                }
            """,
            'variables': {'name': 'Tomato', 'careNotes': 'Full sun'},
        },
        content_type='application/json',
    )

    plant = Plant.objects.get()

    assert response.status_code == 200
    assert response.json()['data']['createPlant'] == {
        'id': str(plant.id),
        'name': 'Tomato',
        'careNotes': 'Full sun',
        'createdAt': plant.created_at.isoformat(),
        'updatedAt': plant.updated_at.isoformat(),
    }


@pytest.mark.django_db
def test_create_plant_mutation_allows_blank_care_notes(client):
    response = client.post(
        '/graphql/',
        data={
            'query': """
                mutation CreatePlant($name: String!) {
                    createPlant(name: $name) {
                        name
                        careNotes
                    }
                }
            """,
            'variables': {'name': 'Tomato'},
        },
        content_type='application/json',
    )

    assert response.status_code == 200
    assert response.json()['data']['createPlant'] == {
        'name': 'Tomato',
        'careNotes': '',
    }
    assert Plant.objects.get().care_notes == ''


@pytest.mark.django_db
def test_edit_plant_mutation_updates_and_returns_plant(client):
    plant = Plant.objects.create(name='Tomato', care_notes='Full sun')

    response = client.post(
        '/graphql/',
        data={
            'query': """
                mutation EditPlant($id: ID!, $name: String!, $careNotes: String!) {
                    editPlant(id: $id, name: $name, careNotes: $careNotes) {
                        id
                        name
                        careNotes
                        createdAt
                        updatedAt
                    }
                }
            """,
            'variables': {
                'id': str(plant.id),
                'name': 'Updated Tomato',
                'careNotes': 'Water deeply',
            },
        },
        content_type='application/json',
    )

    plant.refresh_from_db()

    assert response.status_code == 200
    assert response.json()['data']['editPlant'] == {
        'id': str(plant.id),
        'name': 'Updated Tomato',
        'careNotes': 'Water deeply',
        'createdAt': plant.created_at.isoformat(),
        'updatedAt': plant.updated_at.isoformat(),
    }
    assert plant.name == 'Updated Tomato'
    assert plant.care_notes == 'Water deeply'


@pytest.mark.django_db
def test_edit_plant_mutation_returns_clean_error_for_missing_plant(client):
    response = client.post(
        '/graphql/',
        data={
            'query': """
                mutation EditPlant($id: ID!, $name: String!) {
                    editPlant(id: $id, name: $name) {
                        id
                        name
                    }
                }
            """,
            'variables': {'id': '999', 'name': 'Updated Tomato'},
        },
        content_type='application/json',
    )

    body = response.json()

    assert response.status_code == 200
    assert body['data'] is None
    assert body['errors'][0]['message'] == 'Plant not found'
