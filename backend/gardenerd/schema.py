import strawberry

from apps.containers.graphql.Container.mutations import ContainerMutations
from apps.containers.graphql.Container.queries import ContainerQueries


@strawberry.type
class Query(ContainerQueries):
    @strawberry.field
    def health(self) -> str:
        return 'ok'


@strawberry.type
class Mutation(ContainerMutations):
    pass


schema = strawberry.Schema(query=Query, mutation=Mutation)
