import strawberry

from apps.containers.graphql.Container.mutations import ContainerMutations
from apps.containers.graphql.Container.queries import ContainerQueries
from apps.growing_trials.graphql.GrowingTrial.mutations import GrowingTrialMutations
from apps.growing_trials.graphql.GrowingTrial.queries import GrowingTrialQueries
from apps.journal.graphql.JournalEvent.mutations import JournalEventMutations
from apps.journal.graphql.JournalEvent.queries import JournalEventQueries
from apps.plants.graphql.Plant.mutations import PlantMutations
from apps.plants.graphql.Plant.queries import PlantQueries


@strawberry.type
class Query(ContainerQueries, GrowingTrialQueries, JournalEventQueries, PlantQueries):
    @strawberry.field
    def health(self) -> str:
        return 'ok'


@strawberry.type
class Mutation(
    ContainerMutations,
    GrowingTrialMutations,
    JournalEventMutations,
    PlantMutations,
):
    pass


schema = strawberry.Schema(query=Query, mutation=Mutation)
