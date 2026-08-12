from apps.plants.graphql.Plant.types import PlantType


def test_plant_type_exposes_plant_fields():
    field_names = {
        field.python_name for field in PlantType.__strawberry_definition__.fields
    }

    assert field_names == {'id', 'name', 'care_notes', 'created_at', 'updated_at'}
