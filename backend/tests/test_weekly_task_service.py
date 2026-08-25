from dataclasses import FrozenInstanceError
from datetime import UTC, date, datetime, timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.containers.models import Container
from apps.growing_trials.models import (
    GrowingTrial,
    GrowingTrialStartMethod,
    GrowingTrialStatus,
)
from apps.plants.models import Plant
from apps.tasks.services import (
    INVALID_TIME_ZONE,
    INVALID_TIME_ZONE_MESSAGE,
    WeeklyTaskGenerationError,
    generate_weekly_tasks,
)

REFERENCE = datetime(2026, 8, 19, 12, tzinfo=UTC)


def _create_trial(
    *,
    plant_name='Basil',
    container_name='Bed 1',
    status=GrowingTrialStatus.ACTIVE,
    start_date=date(2026, 8, 1),
    start_method=GrowingTrialStartMethod.SEED,
    care_notes='',
):
    fields = {
        'plant': Plant.objects.create(name=plant_name, care_notes=care_notes),
        'container': Container.objects.create(name=container_name),
        'status': status,
    }
    if status in [GrowingTrialStatus.ACTIVE, GrowingTrialStatus.COMPLETED]:
        fields.update(start_date=start_date, start_method=start_method)
    if status in [GrowingTrialStatus.COMPLETED, GrowingTrialStatus.ABANDONED]:
        fields['end_date'] = date(2026, 8, 18)
    return GrowingTrial.objects.create(**fields)


def _tasks(week, scheduled_date):
    day = next(day for day in week.days if day.date == scheduled_date)
    return day.tasks


@pytest.mark.django_db
@pytest.mark.parametrize('weekday', range(7))
def test_week_is_strictly_following_monday_through_sunday_for_every_weekday(
    weekday,
):
    reference = datetime(2026, 8, 17 + weekday, 12, tzinfo=UTC)

    week = generate_weekly_tasks(time_zone='UTC', reference_datetime=reference)

    assert week.start_date == date(2026, 8, 24)
    assert week.end_date == date(2026, 8, 30)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('reference', 'time_zone', 'expected_start', 'expected_end'),
    [
        (
            datetime(2025, 12, 31, 23, 30, tzinfo=UTC),
            'Pacific/Kiritimati',
            date(2026, 1, 5),
            date(2026, 1, 11),
        ),
        (
            datetime(2024, 2, 25, 12, tzinfo=UTC),
            'UTC',
            date(2024, 2, 26),
            date(2024, 3, 3),
        ),
        (
            datetime(2026, 3, 8, 7, 30, tzinfo=UTC),
            'America/Los_Angeles',
            date(2026, 3, 9),
            date(2026, 3, 15),
        ),
        (
            datetime(2026, 11, 1, 8, 30, tzinfo=UTC),
            'America/Los_Angeles',
            date(2026, 11, 2),
            date(2026, 11, 8),
        ),
    ],
)
def test_week_boundaries_follow_browser_calendar_across_calendar_and_dst_edges(
    reference,
    time_zone,
    expected_start,
    expected_end,
):
    week = generate_weekly_tasks(
        time_zone=time_zone,
        reference_datetime=reference,
    )

    assert (week.start_date, week.end_date) == (expected_start, expected_end)


@pytest.mark.django_db
def test_browser_local_date_can_differ_from_server_utc_date():
    reference = datetime(2026, 8, 17, 0, 30, tzinfo=UTC)

    los_angeles = generate_weekly_tasks(
        time_zone='America/Los_Angeles', reference_datetime=reference
    )
    utc = generate_weekly_tasks(time_zone='UTC', reference_datetime=reference)

    assert los_angeles.start_date == date(2026, 8, 17)
    assert utc.start_date == date(2026, 8, 24)


@pytest.mark.django_db
def test_invalid_time_zone_has_stable_error():
    with pytest.raises(WeeklyTaskGenerationError) as error:
        generate_weekly_tasks(time_zone='Not/A_Time_Zone', reference_datetime=REFERENCE)

    assert error.value.code == INVALID_TIME_ZONE
    assert str(error.value) == INVALID_TIME_ZONE_MESSAGE


@pytest.mark.django_db
def test_reference_datetime_must_be_aware():
    with pytest.raises(ValueError, match='timezone-aware'):
        generate_weekly_tasks(
            time_zone='UTC', reference_datetime=datetime(2026, 8, 19, 12)
        )


@pytest.mark.django_db
def test_empty_week_retains_calculated_boundaries_and_omits_all_days():
    week = generate_weekly_tasks(time_zone='UTC', reference_datetime=REFERENCE)

    assert week.start_date == date(2026, 8, 24)
    assert week.end_date == date(2026, 8, 30)
    assert week.days == ()


@pytest.mark.django_db
def test_only_active_trials_generate_tasks_and_global_tasks_are_deduplicated():
    active_trials = [_create_trial(container_name=f'Bed {index}') for index in range(2)]
    for index, status in enumerate(
        [
            GrowingTrialStatus.PLANNED,
            GrowingTrialStatus.COMPLETED,
            GrowingTrialStatus.ABANDONED,
        ],
        start=2,
    ):
        _create_trial(container_name=f'Bed {index}', status=status)

    week = generate_weekly_tasks(time_zone='UTC', reference_datetime=REFERENCE)

    assert len(_tasks(week, date(2026, 8, 24))) == len(active_trials)
    assert len(_tasks(week, date(2026, 8, 26))) == 1
    assert len(_tasks(week, date(2026, 8, 29))) == len(active_trials)
    assert len(_tasks(week, date(2026, 8, 30))) == 1
    assert all('Bed 2' not in task.text for day in week.days for task in day.tasks)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('method', 'age', 'expected_rule'),
    [
        (GrowingTrialStartMethod.SEED, 20, 'seed-sprouts'),
        (GrowingTrialStartMethod.SEED, 21, 'seed-sprouts'),
        (GrowingTrialStartMethod.SEED, 22, None),
        (GrowingTrialStartMethod.SEEDLING_TRANSPLANT, 13, 'transplant-adjustment'),
        (GrowingTrialStartMethod.SEEDLING_TRANSPLANT, 14, 'transplant-adjustment'),
        (GrowingTrialStartMethod.SEEDLING_TRANSPLANT, 15, None),
    ],
)
def test_tuesday_age_rules_include_exact_boundary_and_exclude_after_it(
    method,
    age,
    expected_rule,
):
    tuesday = date(2026, 8, 25)
    _create_trial(start_date=tuesday - timedelta(days=age), start_method=method)

    week = generate_weekly_tasks(time_zone='UTC', reference_datetime=REFERENCE)
    tuesday_days = [day for day in week.days if day.date == tuesday]

    if expected_rule is None:
        assert tuesday_days == []
    else:
        assert len(tuesday_days[0].tasks) == 1
        assert f':{expected_rule}:' in tuesday_days[0].tasks[0].key


@pytest.mark.django_db
def test_care_notes_rule_requires_nonblank_notes_and_prompts_use_both_names():
    _create_trial(
        plant_name='Thai Basil', container_name='Blue Pot', care_notes='Full sun'
    )
    _create_trial(plant_name='Mint', container_name='Green Pot', care_notes='')

    week = generate_weekly_tasks(time_zone='UTC', reference_datetime=REFERENCE)
    thursday_tasks = _tasks(week, date(2026, 8, 27))

    assert len(thursday_tasks) == 1
    assert thursday_tasks[0].text == (
        'Review the care notes for Thai Basil in Blue Pot before deciding whether '
        'it needs anything.'
    )


@pytest.mark.django_db
def test_days_and_trials_have_deterministic_case_insensitive_order():
    third = _create_trial(plant_name='Chard', container_name='beta')
    first = _create_trial(plant_name='zucchini', container_name='Alpha')
    second = _create_trial(plant_name='Basil', container_name='alpha')

    week = generate_weekly_tasks(time_zone='UTC', reference_datetime=REFERENCE)

    assert [day.date for day in week.days] == sorted(day.date for day in week.days)
    assert [task.key.rsplit(':', 1)[-1] for task in week.days[0].tasks] == [
        str(second.id),
        str(first.id),
        str(third.id),
    ]


@pytest.mark.django_db
def test_keys_and_all_fixed_prompts_are_exact():
    trial = _create_trial(
        plant_name='Basil',
        container_name='Patio Pot',
        start_date=date(2026, 8, 10),
        care_notes='Keep warm',
    )

    week = generate_weekly_tasks(time_zone='UTC', reference_datetime=REFERENCE)

    assert [
        (day.date, [(task.key, task.text) for task in day.tasks]) for day in week.days
    ] == [
        (
            date(2026, 8, 24),
            [
                (
                    f'weekly-task:v1:2026-08-24:soil-moisture:{trial.id}',
                    'Check soil moisture for Basil in Patio Pot. Water only if the '
                    'top inch feels dry.',
                )
            ],
        ),
        (
            date(2026, 8, 25),
            [
                (
                    f'weekly-task:v1:2026-08-25:seed-sprouts:{trial.id}',
                    'Look for sprouts from Basil in Patio Pot and note what you see.',
                )
            ],
        ),
        (
            date(2026, 8, 26),
            [
                (
                    'weekly-task:v1:2026-08-26:garden-health',
                    'Check active Growing Trials for pests or other problems.',
                )
            ],
        ),
        (
            date(2026, 8, 27),
            [
                (
                    f'weekly-task:v1:2026-08-27:care-notes:{trial.id}',
                    'Review the care notes for Basil in Patio Pot before deciding '
                    'whether it needs anything.',
                )
            ],
        ),
        (
            date(2026, 8, 29),
            [
                (
                    f'weekly-task:v1:2026-08-29:growth-observation:{trial.id}',
                    'Add a growth observation for Basil in Patio Pot.',
                )
            ],
        ),
        (
            date(2026, 8, 30),
            [
                (
                    'weekly-task:v1:2026-08-30:weekly-review',
                    'Review the changes you noticed across active Growing Trials '
                    'this week.',
                )
            ],
        ),
    ]


@pytest.mark.django_db
def test_generation_uses_one_select_query_and_performs_no_writes():
    for index in range(20):
        _create_trial(container_name=f'Bed {index:02}')

    with CaptureQueriesContext(connection) as queries:
        week = generate_weekly_tasks(time_zone='UTC', reference_datetime=REFERENCE)

    assert len(week.days[0].tasks) == 20
    assert len(queries) == 1
    assert queries[0]['sql'].lstrip().upper().startswith('SELECT')


@pytest.mark.django_db
def test_generated_values_are_deeply_immutable():
    _create_trial()
    week = generate_weekly_tasks(time_zone='UTC', reference_datetime=REFERENCE)

    with pytest.raises(FrozenInstanceError):
        week.start_date = date(2026, 1, 1)
    with pytest.raises(FrozenInstanceError):
        week.days[0].tasks[0].text = 'changed'
    assert isinstance(week.days, tuple)
    assert isinstance(week.days[0].tasks, tuple)
