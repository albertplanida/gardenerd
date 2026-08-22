import base64
from datetime import date

import pytest

from apps.containers.models import Container
from apps.growing_trials.graphql.GrowingTrial.queries import (
    DEFAULT_GROWING_TRIALS_QUERY_LIMIT,
    INVALID_GROWING_TRIAL_CURSOR_MESSAGE,
)
from apps.growing_trials.models import (
    GrowingTrial,
    GrowingTrialStartMethod,
    GrowingTrialStatus,
)
from apps.plants.models import Plant


def _cursor(value: str) -> str:
    return base64.b64encode(value.encode()).decode()


def _post_growing_trials(client, variables=None):
    return client.post(
        '/graphql/',
        data={
            'query': """
                query GrowingTrials(
                    $limit: Int
                    $after: String
                    $status: GrowingTrialStatusType
                ) {
                    growingTrials(limit: $limit, after: $after, status: $status) {
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
                        endCursor
                    }
                }
            """,
            'variables': variables or {},
        },
        content_type='application/json',
    )


def _create_trials(count):
    plant = Plant.objects.create(name='Radish')
    return [
        GrowingTrial.objects.create_planned(
            plant=plant,
            container=Container.objects.create(name=f'Pot {index}'),
        )
        for index in range(count)
    ]


def _create_trial(status: GrowingTrialStatus, index: int):
    fields = {
        'plant': Plant.objects.create(name=f'Plant {index}'),
        'container': Container.objects.create(name=f'Pot {index}'),
        'status': status,
    }
    if status in [GrowingTrialStatus.ACTIVE, GrowingTrialStatus.COMPLETED]:
        fields.update(
            start_date=date(2026, 8, 1),
            start_method=GrowingTrialStartMethod.SEED,
        )
    if status in [GrowingTrialStatus.COMPLETED, GrowingTrialStatus.ABANDONED]:
        fields['end_date'] = date(2026, 8, 20)
    return GrowingTrial.objects.create(**fields)


@pytest.mark.django_db
def test_growing_trials_query_returns_empty_first_page(client):
    page = _post_growing_trials(client).json()['data']['growingTrials']

    assert page == {
        'items': [],
        'hasNextPage': False,
        'hasPreviousPage': False,
        'endCursor': None,
    }


@pytest.mark.django_db
def test_growing_trials_query_returns_newest_first_with_relationships(client):
    first, second = _create_trials(2)

    page = _post_growing_trials(client).json()['data']['growingTrials']

    assert [item['id'] for item in page['items']] == [str(second.id), str(first.id)]
    assert page['items'][0] == {
        'id': str(second.id),
        'plant': {'id': str(second.plant.id), 'name': 'Radish'},
        'container': {'id': str(second.container.id), 'name': 'Pot 1'},
        'status': 'PLANNED',
        'createdAt': second.created_at.isoformat(),
        'updatedAt': second.updated_at.isoformat(),
    }
    assert page['endCursor'] == _cursor(f'growing-trial:v1:{first.id}')


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('status', 'expected_status'),
    [
        ('PLANNED', GrowingTrialStatus.PLANNED),
        ('ACTIVE', GrowingTrialStatus.ACTIVE),
        ('COMPLETED', GrowingTrialStatus.COMPLETED),
        ('ABANDONED', GrowingTrialStatus.ABANDONED),
    ],
)
def test_growing_trials_query_filters_by_status(client, status, expected_status):
    expected = _create_trial(expected_status, 1)
    for index, other_status in enumerate(
        set(GrowingTrialStatus.values) - {expected_status}, start=2
    ):
        _create_trial(other_status, index)

    page = _post_growing_trials(client, {'status': status}).json()['data'][
        'growingTrials'
    ]

    assert [item['id'] for item in page['items']] == [str(expected.id)]
    assert page['items'][0]['status'] == status


@pytest.mark.django_db
@pytest.mark.parametrize('variables', [{}, {'status': None}])
def test_growing_trials_query_treats_omitted_or_null_status_as_all(client, variables):
    trials = [
        _create_trial(GrowingTrialStatus.PLANNED, 1),
        _create_trial(GrowingTrialStatus.ACTIVE, 2),
        _create_trial(GrowingTrialStatus.COMPLETED, 3),
        _create_trial(GrowingTrialStatus.ABANDONED, 4),
    ]

    page = _post_growing_trials(client, variables).json()['data']['growingTrials']

    assert [item['id'] for item in page['items']] == [
        str(trial.id) for trial in reversed(trials)
    ]


@pytest.mark.django_db
def test_growing_trials_query_filters_before_pagination(client):
    expected = []
    for index in range(1, 7):
        status = GrowingTrialStatus.ACTIVE if index % 2 else GrowingTrialStatus.PLANNED
        trial = _create_trial(status, index)
        if status == GrowingTrialStatus.ACTIVE:
            expected.append(trial)

    first_page = _post_growing_trials(client, {'limit': 2, 'status': 'ACTIVE'}).json()[
        'data'
    ]['growingTrials']
    second_page = _post_growing_trials(
        client,
        {
            'limit': 2,
            'after': first_page['endCursor'],
            'status': 'ACTIVE',
        },
    ).json()['data']['growingTrials']

    assert [item['id'] for item in first_page['items']] == [
        str(trial.id) for trial in reversed(expected[-2:])
    ]
    assert first_page['hasNextPage'] is True
    assert [item['id'] for item in second_page['items']] == [str(expected[0].id)]
    assert second_page['hasNextPage'] is False
    assert second_page['hasPreviousPage'] is True


@pytest.mark.django_db
def test_growing_trials_query_rejects_invalid_status(client):
    body = _post_growing_trials(client, {'status': 'UNKNOWN'}).json()

    assert body['data'] is None
    assert 'does not exist in' in body['errors'][0]['message']


@pytest.mark.django_db
def test_growing_trials_query_returns_complete_first_page(client):
    trials = _create_trials(DEFAULT_GROWING_TRIALS_QUERY_LIMIT + 1)

    page = _post_growing_trials(client).json()['data']['growingTrials']

    expected = list(reversed(trials))[:DEFAULT_GROWING_TRIALS_QUERY_LIMIT]
    assert [item['id'] for item in page['items']] == [
        str(trial.id) for trial in expected
    ]
    assert page['hasNextPage'] is True
    assert page['hasPreviousPage'] is False
    assert page['endCursor'] == _cursor(f'growing-trial:v1:{expected[-1].id}')


@pytest.mark.django_db
def test_growing_trials_query_returns_middle_and_final_pages(client):
    trials = _create_trials(5)

    middle = _post_growing_trials(
        client, {'limit': 2, 'after': _cursor(f'growing-trial:v1:{trials[3].id}')}
    ).json()['data']['growingTrials']
    final = _post_growing_trials(
        client, {'limit': 2, 'after': middle['endCursor']}
    ).json()['data']['growingTrials']

    assert [item['id'] for item in middle['items']] == [
        str(trials[2].id),
        str(trials[1].id),
    ]
    assert middle['hasNextPage'] is True
    assert middle['hasPreviousPage'] is True
    assert [item['id'] for item in final['items']] == [str(trials[0].id)]
    assert final['hasNextPage'] is False
    assert final['hasPreviousPage'] is True


@pytest.mark.django_db
@pytest.mark.parametrize('limit', [1, 50])
def test_growing_trials_query_accepts_supported_limit_boundaries(client, limit):
    _create_trials(2)

    body = _post_growing_trials(client, {'limit': limit}).json()

    assert 'errors' not in body
    assert len(body['data']['growingTrials']['items']) == min(limit, 2)


@pytest.mark.django_db
@pytest.mark.parametrize('limit', [0, 51])
def test_growing_trials_query_rejects_invalid_limits(client, limit):
    body = _post_growing_trials(client, {'limit': limit, 'status': 'PLANNED'}).json()

    assert body['data'] is None
    assert body['errors'][0]['message'] == (
        'Growing Trial query limit must be between 1 and 50'
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    'after',
    [
        'not base64!',
        _cursor('other:v1:1'),
        _cursor('growing-trial:v1:not-an-id'),
        _cursor('growing-trial:v1:0'),
        _cursor('growing-trial:v1:-1'),
    ],
)
def test_growing_trials_query_rejects_malformed_cursors(client, after):
    body = _post_growing_trials(client, {'after': after, 'status': 'PLANNED'}).json()

    assert body['data'] is None
    assert body['errors'][0]['message'] == INVALID_GROWING_TRIAL_CURSOR_MESSAGE


@pytest.mark.django_db
def test_growing_trials_continuation_is_stable_after_an_insert(client):
    trials = _create_trials(4)
    first_page = _post_growing_trials(client, {'limit': 2}).json()['data'][
        'growingTrials'
    ]
    GrowingTrial.objects.create_planned(
        plant=trials[0].plant,
        container=Container.objects.create(name='New pot'),
    )

    second_page = _post_growing_trials(
        client, {'limit': 2, 'after': first_page['endCursor']}
    ).json()['data']['growingTrials']

    assert [item['id'] for item in second_page['items']] == [
        str(trials[1].id),
        str(trials[0].id),
    ]


@pytest.mark.django_db
def test_filtered_growing_trials_continuation_is_stable_after_an_insert(client):
    trials = [_create_trial(GrowingTrialStatus.ACTIVE, index) for index in range(1, 5)]
    first_page = _post_growing_trials(client, {'limit': 2, 'status': 'ACTIVE'}).json()[
        'data'
    ]['growingTrials']
    _create_trial(GrowingTrialStatus.ACTIVE, 5)

    second_page = _post_growing_trials(
        client,
        {
            'limit': 2,
            'after': first_page['endCursor'],
            'status': 'ACTIVE',
        },
    ).json()['data']['growingTrials']

    assert [item['id'] for item in second_page['items']] == [
        str(trials[1].id),
        str(trials[0].id),
    ]


@pytest.mark.django_db
def test_growing_trials_query_eager_loads_relationships(
    client, django_assert_num_queries
):
    _create_trials(20)

    with django_assert_num_queries(1):
        response = _post_growing_trials(client)

    assert response.status_code == 200


@pytest.mark.django_db
def test_growing_trials_schema_no_longer_accepts_offset(client):
    response = client.post(
        '/graphql/',
        data={'query': '{ growingTrials(offset: 1) { items { id } } }'},
        content_type='application/json',
    )

    assert 'Unknown argument' in response.json()['errors'][0]['message']
