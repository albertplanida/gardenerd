import strawberry

from apps.containers.graphql.Container.mutations import ContainerMutations
from apps.containers.graphql.Container.queries import ContainerQueries
from apps.plants.graphql.Plant.mutations import PlantMutations
from apps.plants.graphql.Plant.queries import PlantQueries


@strawberry.type
class Query(ContainerQueries, PlantQueries):
    @strawberry.field
    def health(self) -> str:
        return 'ok'


@strawberry.type
class Mutation(ContainerMutations, PlantMutations):
    pass


schema = strawberry.Schema(query=Query, mutation=Mutation)
