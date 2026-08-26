from datetime import datetime, timedelta

from django.db.models.functions import Lower
from django.utils import timezone

from apps.growing_trials.models import (
    GrowingTrial,
    GrowingTrialStartMethod,
    GrowingTrialStatus,
)
from apps.tasks.types import WeeklyTask, WeeklyTaskDay, WeeklyTaskWeek
from apps.time_zones import InvalidBrowserTimeZone, parse_browser_time_zone

INVALID_TIME_ZONE = 'INVALID_TIME_ZONE'
INVALID_TIME_ZONE_MESSAGE = 'Browser time zone is invalid; refresh and try again.'


class WeeklyTaskGenerationError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


def _task(scheduled_date, rule_kind, text, trial_id=None):
    key = f'weekly-task:v1:{scheduled_date.isoformat()}:{rule_kind}'
    if trial_id is not None:
        key = f'{key}:{trial_id}'
    return WeeklyTask(key=key, text=text)


def _trial_has_started(trial: GrowingTrial, scheduled_date) -> bool:
    return trial.start_date <= scheduled_date


def generate_weekly_tasks(
    *,
    time_zone: str,
    reference_datetime: datetime | None = None,
) -> WeeklyTaskWeek:
    try:
        browser_time_zone = parse_browser_time_zone(time_zone)
    except InvalidBrowserTimeZone as exc:
        raise WeeklyTaskGenerationError(
            INVALID_TIME_ZONE,
            INVALID_TIME_ZONE_MESSAGE,
        ) from exc

    reference_datetime = reference_datetime or timezone.now()
    if reference_datetime.tzinfo is None or reference_datetime.utcoffset() is None:
        raise ValueError('reference_datetime must be timezone-aware')

    local_date = reference_datetime.astimezone(browser_time_zone).date()
    start_date = local_date - timedelta(days=local_date.weekday())
    end_date = start_date + timedelta(days=6)
    scheduled_dates = {
        'monday': start_date,
        'tuesday': start_date + timedelta(days=1),
        'wednesday': start_date + timedelta(days=2),
        'thursday': start_date + timedelta(days=3),
        'saturday': start_date + timedelta(days=5),
        'sunday': end_date,
    }

    trials = list(
        GrowingTrial.objects.filter(status=GrowingTrialStatus.ACTIVE)
        .select_related('plant', 'container')
        .order_by(Lower('container__name'), Lower('plant__name'), 'id')
    )
    if not trials:
        return WeeklyTaskWeek(start_date=start_date, end_date=end_date, days=())

    tasks_by_date = {scheduled_date: [] for scheduled_date in scheduled_dates.values()}
    for trial in trials:
        subject = f'{trial.plant.name} in {trial.container.name}'
        if _trial_has_started(trial, scheduled_dates['monday']):
            tasks_by_date[scheduled_dates['monday']].append(
                _task(
                    scheduled_dates['monday'],
                    'soil-moisture',
                    f'Check soil moisture for {subject}. '
                    'Water only if the top inch feels dry.',
                    trial.id,
                )
            )

        if _trial_has_started(trial, scheduled_dates['tuesday']):
            elapsed_days = (scheduled_dates['tuesday'] - trial.start_date).days
            if (
                trial.start_method == GrowingTrialStartMethod.SEED
                and elapsed_days <= 21
            ):
                tasks_by_date[scheduled_dates['tuesday']].append(
                    _task(
                        scheduled_dates['tuesday'],
                        'seed-sprouts',
                        f'Look for sprouts from {subject} and note what you see.',
                        trial.id,
                    )
                )
            if (
                trial.start_method == GrowingTrialStartMethod.SEEDLING_TRANSPLANT
                and elapsed_days <= 14
            ):
                tasks_by_date[scheduled_dates['tuesday']].append(
                    _task(
                        scheduled_dates['tuesday'],
                        'transplant-adjustment',
                        f'Check how {subject} is adjusting after transplanting.',
                        trial.id,
                    )
                )

        if (
            _trial_has_started(trial, scheduled_dates['thursday'])
            and trial.plant.care_notes.strip()
        ):
            tasks_by_date[scheduled_dates['thursday']].append(
                _task(
                    scheduled_dates['thursday'],
                    'care-notes',
                    f'Review the care notes for {subject} before deciding whether '
                    'it needs anything.',
                    trial.id,
                )
            )

        if _trial_has_started(trial, scheduled_dates['saturday']):
            tasks_by_date[scheduled_dates['saturday']].append(
                _task(
                    scheduled_dates['saturday'],
                    'growth-observation',
                    f'Add a growth observation for {subject}.',
                    trial.id,
                )
            )

    if any(_trial_has_started(trial, scheduled_dates['wednesday']) for trial in trials):
        tasks_by_date[scheduled_dates['wednesday']].append(
            _task(
                scheduled_dates['wednesday'],
                'garden-health',
                'Check active Growing Trials for pests or other problems.',
            )
        )
    if any(_trial_has_started(trial, scheduled_dates['sunday']) for trial in trials):
        tasks_by_date[scheduled_dates['sunday']].append(
            _task(
                scheduled_dates['sunday'],
                'weekly-review',
                'Review the changes you noticed across active Growing Trials '
                'this week.',
            )
        )

    days = tuple(
        WeeklyTaskDay(date=scheduled_date, tasks=tuple(tasks_by_date[scheduled_date]))
        for scheduled_date in sorted(tasks_by_date)
        if tasks_by_date[scheduled_date]
    )
    return WeeklyTaskWeek(start_date=start_date, end_date=end_date, days=days)
