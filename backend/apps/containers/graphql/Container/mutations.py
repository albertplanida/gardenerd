import strawberry

from apps.containers.graphql.Container.types import ContainerType
from apps.containers.models import Container


@strawberry.type
class ContainerMutations:
    @strawberry.mutation
    def create_container(self, name: str) -> ContainerType:
        return Container.objects.create(name=name)

    @strawberry.mutation
    def edit_container(self, id: strawberry.ID, name: str) -> ContainerType:
        try:
            container = Container.objects.get(pk=id)
        except Container.DoesNotExist as exc:
            raise ValueError('Container not found') from exc

        container.name = name
        container.save(update_fields=['name', 'updated_at'])
        return container
