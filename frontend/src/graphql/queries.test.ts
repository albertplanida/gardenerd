import {
  CONTAINERS_QUERY,
  CREATE_CONTAINER_MUTATION,
  EDIT_CONTAINER_MUTATION,
} from "./queries";

describe("Container GraphQL documents", () => {
  it("exports the Container list query", () => {
    expect(CONTAINERS_QUERY).toContain("query Containers");
    expect(CONTAINERS_QUERY).toContain("containers");
    expect(CONTAINERS_QUERY).toContain("createdAt");
    expect(CONTAINERS_QUERY).toContain("updatedAt");
  });

  it("exports the create Container mutation", () => {
    expect(CREATE_CONTAINER_MUTATION).toContain("mutation CreateContainer");
    expect(CREATE_CONTAINER_MUTATION).toContain("createContainer");
  });

  it("exports the edit Container mutation", () => {
    expect(EDIT_CONTAINER_MUTATION).toContain("mutation EditContainer");
    expect(EDIT_CONTAINER_MUTATION).toContain("editContainer");
  });
});
