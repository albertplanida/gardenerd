from datetime import UTC, date, datetime

import pytest

from apps.containers.models import Container
from apps.growing_trials.models import (
    GrowingTrial,
    GrowingTrialStartMethod,
    GrowingTrialStatus,
)
from apps.plants.models import Plant
from apps.tasks.services import generate_weekly_tasks
from gardenerd.schema import schema

REFERENCE = datetime(2026, 8, 19, 12, tzinfo=UTC)
QUERY = """
    query WeeklyTasks($timeZone: String!) {
        weeklyTasks(timeZone: $timeZone) {
            startDate
            endDate
            days { date tasks { key text } }
        }
    }
"""


def _post(client, variables=None, query=QUERY):
    return client.post(
        '/graphql/',
        data={'query': query, 'variables': variables or {}},
        content_type='application/json',
    )


def _active_trial():
    return GrowingTrial.objects.create(
        plant=Plant.objects.create(name='Basil', care_notes='Keep warm'),
        container=Container.objects.create(name='Patio Pot'),
        status=GrowingTrialStatus.ACTIVE,
        start_date=date(2026, 8, 10),
        start_method=GrowingTrialStartMethod.SEED,
    )


def test_weekly_tasks_schema_has_required_time_zone_and_named_week_type():
    assert 'weeklyTasks(timeZone: String!): WeeklyTaskWeek!' in schema.as_str()


@pytest.fixture(autouse=True)
def fixed_reference(monkeypatch):
    def generate(*, time_zone):
        return generate_weekly_tasks(
            time_zone=time_zone,
            reference_datetime=REFERENCE,
        )

    monkeypatch.setattr(
        'apps.tasks.graphql.WeeklyTask.queries.generate_weekly_tasks', generate
    )


@pytest.mark.django_db
def test_weekly_tasks_returns_complete_grouped_payload_and_serialized_boundaries(
    client,
):
    trial = _active_trial()

    body = _post(client, {'timeZone': 'UTC'}).json()

    assert 'errors' not in body
    week = body['data']['weeklyTasks']
    assert (week['startDate'], week['endDate']) == ('2026-08-24', '2026-08-30')
    assert [day['date'] for day in week['days']] == [
        '2026-08-24',
        '2026-08-25',
        '2026-08-26',
        '2026-08-27',
        '2026-08-29',
        '2026-08-30',
    ]
    assert week['days'][0]['tasks'][0] == {
        'key': f'weekly-task:v1:2026-08-24:soil-moisture:{trial.id}',
        'text': (
            'Check soil moisture for Basil in Patio Pot. Water only if the top '
            'inch feels dry.'
        ),
    }
    assert week['days'][-1]['tasks'][0]['key'] == (
        'weekly-task:v1:2026-08-30:weekly-review'
    )


@pytest.mark.django_db
def test_weekly_tasks_is_active_only(client):
    active = _active_trial()
    GrowingTrial.objects.create_planned(
        plant=Plant.objects.create(name='Mint'),
        container=Container.objects.create(name='Other Pot'),
    )

    week = _post(client, {'timeZone': 'UTC'}).json()['data']['weeklyTasks']

    keys = [task['key'] for day in week['days'] for task in day['tasks']]
    assert any(key.endswith(f':{active.id}') for key in keys)
    assert all(
        'Mint' not in task['text'] for day in week['days'] for task in day['tasks']
    )


@pytest.mark.django_db
def test_weekly_tasks_empty_week_keeps_boundaries(client):
    assert _post(client, {'timeZone': 'UTC'}).json()['data']['weeklyTasks'] == {
        'startDate': '2026-08-24',
        'endDate': '2026-08-30',
        'days': [],
    }


@pytest.mark.django_db
def test_weekly_tasks_requires_time_zone(client):
    body = _post(client).json()

    assert body['data'] is None
    assert (
        "Variable '$timeZone' of required type 'String!' was not provided"
        in body['errors'][0]['message']
    )


@pytest.mark.django_db
def test_weekly_tasks_returns_safe_invalid_time_zone_error(client):
    body = _post(client, {'timeZone': 'Not/A_Time_Zone'}).json()

    assert body['data'] is None
    assert body['errors'][0]['message'] == (
        'Browser time zone is invalid; refresh and try again.'
    )
    assert body['errors'][0]['extensions']['code'] == 'INVALID_TIME_ZONE'


@pytest.mark.django_db
def test_weekly_tasks_masks_and_logs_internal_errors(client, monkeypatch, caplog):
    def fail(*, time_zone):
        raise RuntimeError(f'secret implementation detail: {time_zone}')

    monkeypatch.setattr(
        'apps.tasks.graphql.WeeklyTask.queries.generate_weekly_tasks', fail
    )

    with caplog.at_level('ERROR'):
        body = _post(client, {'timeZone': 'UTC'}).json()

    assert body['data'] is None
    assert body['errors'][0]['message'] == 'Internal server error.'
    assert body['errors'][0]['extensions']['code'] == 'INTERNAL_ERROR'
    assert 'secret implementation detail' not in str(body['errors'][0])
    assert 'Unexpected error while generating weekly tasks' in caplog.text
