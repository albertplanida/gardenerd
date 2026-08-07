import strawberry

from apps.containers.graphql.Container.types import ContainerType
from apps.containers.models import Container


@strawberry.type
class ContainerQueries:
    @strawberry.field
    def containers(self) -> list[ContainerType]:
        return Container.objects.order_by('id')
