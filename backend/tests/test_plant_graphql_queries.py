import pytest

from apps.plants.models import Plant


@pytest.mark.django_db
def test_plants_query_returns_empty_list(client):
    response = client.post(
        '/graphql/',
        data={
            'query': """
                query Plants {
                    plants {
                        id
                        name
                        careNotes
                        createdAt
                        updatedAt
                    }
                }
            """
        },
        content_type='application/json',
    )

    assert response.status_code == 200
    assert response.json()['data']['plants'] == []


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
                        id
                        name
                        careNotes
                        createdAt
                        updatedAt
                    }
                }
            """
        },
        content_type='application/json',
    )

    assert response.status_code == 200
    assert response.json()['data']['plants'] == [
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
    ]
