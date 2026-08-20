import { graphqlErrorCode } from "./errors";

describe("graphqlErrorCode", () => {
  it("returns a known domain code", () => {
    expect(
      graphqlErrorCode({
        response: {
          errors: [{ extensions: { code: "GROWING_TRIAL_NOT_PLANNED" } }],
        },
      }),
    ).toBe("GROWING_TRIAL_NOT_PLANNED");
  });

  it.each([
    new Error("network"),
    { response: { errors: [{ extensions: { code: "NEW_SERVER_CODE" } }] } },
    { response: { errors: [] } },
  ])("does not treat an unknown error as a domain outcome", (error) => {
    expect(graphqlErrorCode(error)).toBeNull();
  });
});
