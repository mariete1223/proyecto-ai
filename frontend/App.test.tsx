import { render } from "@testing-library/react-native";
import App from "./App";

describe("App", () => {
  it("renders the starter screen", async () => {
    const { getByText } = await render(<App />);

    expect(getByText("Proyecto AI")).toBeTruthy();
  });
});
