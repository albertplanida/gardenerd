from apps.growing_trials.graphql.GrowingTrial.types import GrowingTrialType


def test_growing_trial_type_exposes_required_fields():
    field_names = {
        field.python_name for field in GrowingTrialType.__strawberry_definition__.fields
    }

    assert field_names == {
        'id',
        'plant',
        'container',
        'status',
        'created_at',
        'updated_at',
    }
