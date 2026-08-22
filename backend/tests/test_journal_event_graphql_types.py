import pytest

from apps.journal.graphql.JournalEvent.types import (
    JournalEventEventType as GraphQLJournalEventEventType,
)
from apps.journal.models import JournalEventEventType


@pytest.mark.django_db
def test_schema_exposes_journal_event_types_query_and_mutations(client):
    response = client.post(
        '/graphql/',
        data={
            'query': """
                query JournalSchema {
                    enumType: __type(name: "JournalEventEventType") {
                        enumValues { name }
                    }
                    pageType: __type(name: "JournalEventPage") {
                        fields { name }
                    }
                    queryType: __type(name: "Query") { fields { name } }
                    mutationType: __type(name: "Mutation") { fields { name } }
                }
            """
        },
        content_type='application/json',
    )

    data = response.json()['data']
    assert {value['name'] for value in data['enumType']['enumValues']} == set(
        JournalEventEventType.names
    )
    assert {field['name'] for field in data['pageType']['fields']} == {
        'items',
        'hasNextPage',
        'endCursor',
    }
    assert 'journalEvents' in {field['name'] for field in data['queryType']['fields']}
    assert {
        'createJournalEvent',
        'updateJournalEvent',
        'deleteJournalEvent',
    } <= {field['name'] for field in data['mutationType']['fields']}


def test_graphql_event_type_is_the_django_text_choices_enum():
    assert GraphQLJournalEventEventType is JournalEventEventType
    assert [(member.name, member.value) for member in GraphQLJournalEventEventType] == [
        (member.name, member.value) for member in JournalEventEventType
    ]
