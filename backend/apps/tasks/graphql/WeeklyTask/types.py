from datetime import date

import strawberry

from apps.tasks.types import WeeklyTaskDay as WeeklyTaskDayValue
from apps.tasks.types import WeeklyTaskWeek as WeeklyTaskWeekValue


@strawberry.type
class WeeklyTask:
    key: str
    text: str


@strawberry.type
class WeeklyTaskDay:
    date: date
    tasks: list[WeeklyTask]


@strawberry.type
class WeeklyTaskWeek:
    start_date: date
    end_date: date
    days: list[WeeklyTaskDay]

    @classmethod
    def from_value(cls, week: WeeklyTaskWeekValue):
        return cls(
            start_date=week.start_date,
            end_date=week.end_date,
            days=[_day_from_value(day) for day in week.days],
        )


def _day_from_value(day: WeeklyTaskDayValue) -> WeeklyTaskDay:
    return WeeklyTaskDay(
        date=day.date,
        tasks=[WeeklyTask(key=task.key, text=task.text) for task in day.tasks],
    )
