import strawberry
import strawberry_django

from apps.containers.models import Container


@strawberry_django.type(Container)
class ContainerType:
    id: strawberry.auto
    name: strawberry.auto
    created_at: strawberry.auto
    updated_at: strawberry.auto
