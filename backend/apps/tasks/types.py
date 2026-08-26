from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class WeeklyTask:
    key: str
    text: str


@dataclass(frozen=True)
class WeeklyTaskDay:
    date: date
    tasks: tuple[WeeklyTask, ...]


@dataclass(frozen=True)
class WeeklyTaskWeek:
    start_date: date
    end_date: date
    days: tuple[WeeklyTaskDay, ...]
