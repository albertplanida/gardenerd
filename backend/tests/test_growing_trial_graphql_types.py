from apps.growing_trials.graphql.GrowingTrial.types import (
    GrowingTrialStartMethod as GraphQLStartMethod,
)
from apps.growing_trials.graphql.GrowingTrial.types import GrowingTrialStatusType
from apps.growing_trials.models import (
    GrowingTrialStartMethod as ModelStartMethod,
)
from apps.growing_trials.models import GrowingTrialStatus


def test_graphql_lifecycle_enums_match_model_enums():
    assert {member.name: member.value for member in GrowingTrialStatusType} == {
        member.name: member.value for member in GrowingTrialStatus
    }
    assert {member.name: member.value for member in GraphQLStartMethod} == {
        member.name: member.value for member in ModelStartMethod
    }
