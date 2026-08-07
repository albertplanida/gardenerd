from apps.containers.graphql.Container.types import ContainerType


def test_container_type_exposes_container_fields():
    field_names = {
        field.python_name for field in ContainerType.__strawberry_definition__.fields
    }

    assert field_names == {'id', 'name', 'created_at', 'updated_at'}
