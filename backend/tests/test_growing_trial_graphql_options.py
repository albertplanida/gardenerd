import pytest

from apps.containers.models import Container
from apps.plants.models import Plant


def _post_options(client, resource, variables=None):
    field = f'growingTrial{resource}Options'
    return client.post(
        '/graphql/',
        data={
            'query': f"""
                query Options($search: String, $limit: Int) {{
                    {field}(search: $search, limit: $limit) {{ id name }}
                }}
            """,
            'variables': variables or {},
        },
        content_type='application/json',
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('resource', 'model'), [('Plant', Plant), ('Container', Container)]
)
def test_option_query_returns_first_20_alphabetically(client, resource, model):
    records = [model.objects.create(name=f'Name {index:02}') for index in range(21)]

    options = _post_options(client, resource).json()['data'][
        f'growingTrial{resource}Options'
    ]

    assert options == [
        {'id': str(record.id), 'name': record.name} for record in records[:20]
    ]


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('resource', 'model'), [('Plant', Plant), ('Container', Container)]
)
def test_option_query_accepts_explicit_limit_up_to_50(client, resource, model):
    for index in range(51):
        model.objects.create(name=f'Name {index:02}')

    options = _post_options(client, resource, {'limit': 50}).json()['data'][
        f'growingTrial{resource}Options'
    ]

    assert len(options) == 50


@pytest.mark.django_db
@pytest.mark.parametrize('limit', [0, 51])
def test_option_query_rejects_invalid_limits(client, limit):
    body = _post_options(client, 'Plant', {'limit': limit}).json()

    assert body['data'] is None
    assert body['errors'][0]['message'] == (
        'Growing Trial option limit must be between 1 and 50'
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('resource', 'model'), [('Plant', Plant), ('Container', Container)]
)
def test_option_query_strips_and_matches_search_case_insensitively(
    client, resource, model
):
    model.objects.create(name='Basil')
    matching = model.objects.create(name='Thai BASIL')
    model.objects.create(name='Rosemary')

    options = _post_options(client, resource, {'search': '  thai basil  '}).json()[
        'data'
    ][f'growingTrial{resource}Options']

    assert options == [{'id': str(matching.id), 'name': 'Thai BASIL'}]


@pytest.mark.django_db
def test_option_search_finds_record_outside_initial_results(client):
    for index in range(20):
        Plant.objects.create(name=f'Plant {index:02}')
    target = Plant.objects.create(name='Zucchini')

    options = _post_options(client, 'Plant', {'search': 'zuc'}).json()['data'][
        'growingTrialPlantOptions'
    ]

    assert options == [{'id': str(target.id), 'name': 'Zucchini'}]


@pytest.mark.django_db
def test_option_query_orders_case_varied_duplicates_by_normalized_name_and_id(client):
    first = Container.objects.create(name='basil')
    second = Container.objects.create(name='Basil')
    third = Container.objects.create(name='BASIL')

    options = _post_options(client, 'Container').json()['data'][
        'growingTrialContainerOptions'
    ]

    assert [option['id'] for option in options] == [
        str(first.id),
        str(second.id),
        str(third.id),
    ]


@pytest.mark.django_db
def test_option_query_can_return_no_search_matches(client):
    Plant.objects.create(name='Basil')

    options = _post_options(client, 'Plant', {'search': 'mint'}).json()['data'][
        'growingTrialPlantOptions'
    ]

    assert options == []


@pytest.mark.django_db
def test_option_query_rejects_overlong_search(client):
    body = _post_options(client, 'Plant', {'search': 'x' * 256}).json()

    assert body['data'] is None
    assert body['errors'][0]['message'] == (
        'Growing Trial option search must be 255 characters or fewer'
    )
