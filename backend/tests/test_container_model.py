import pytest

from apps.containers.models import Container


@pytest.mark.django_db
def test_container_can_be_created_with_name():
    container = Container.objects.create(name='Pot 1')

    assert container.name == 'Pot 1'
    assert container.created_at is not None
    assert container.updated_at is not None


@pytest.mark.django_db
def test_container_string_representation_is_name():
    container = Container.objects.create(name='Pot 2')

    assert str(container) == 'Pot 2'
