def test_healthy_query(client):
    """Verify the GraphQL health query returns an ok response."""
    response = client.post(
        "/graphql/",
        data={"query": "{ health }"},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json()["data"]["health"] == "ok"
