import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { createLocalCategory, listCategories } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { CategoryManager } from "./CategoryManager";

describe("CategoryManager Component", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-789";

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    await createLocalCategory(db, userId, {
      name: "Trabajo",
      voice_command: "trabajo",
      description: "Asuntos laborales",
      color: "#38BDF8",
      icon: "briefcase",
    });
  });

  it("renders existing category list", async () => {
    const { getByTestId, getByText } = await render(
      <CategoryManager db={db} userId={userId} />,
    );

    await waitFor(() => {
      expect(getByTestId("category-manager")).toBeTruthy();
      expect(getByText("Trabajo")).toBeTruthy();
      expect(getByText('Comando: "trabajo"')).toBeTruthy();
      expect(getByText("Desc: Asuntos laborales")).toBeTruthy();
    });
  });

  it("validates empty name or voice command on create", async () => {
    const { getByTestId, getByText } = await render(
      <CategoryManager db={db} userId={userId} />,
    );

    await waitFor(() => {
      expect(getByText("Trabajo")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-cat"));
    });

    await waitFor(() => {
      expect(getByTestId("category-manager-error")).toBeTruthy();
      expect(
        getByText("El nombre y el comando de voz son obligatorios."),
      ).toBeTruthy();
    });
  });

  it("creates a new category successfully", async () => {
    const onChangedMock = jest.fn();
    const { getByTestId, getByText, findByTestId } = await render(
      <CategoryManager
        db={db}
        userId={userId}
        onCategoryChanged={onChangedMock}
      />,
    );

    await waitFor(() => {
      expect(getByText("Trabajo")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.changeText(getByTestId("input-cat-name"), "Salud");
      fireEvent.changeText(getByTestId("input-cat-voice"), "salud");
      fireEvent.changeText(getByTestId("input-cat-desc"), "Citas médicas");
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-cat"));
    });

    expect(await findByTestId("category-manager-success")).toBeTruthy();
    expect(getByText("Salud")).toBeTruthy();
    expect(onChangedMock).toHaveBeenCalledTimes(1);

    const categoriesInDb = await listCategories(db, userId);
    expect(categoriesInDb.some((c) => c.name === "Salud")).toBe(true);
  });

  it("edits an existing category successfully", async () => {
    const { getByTestId, getByText, findByTestId } = await render(
      <CategoryManager db={db} userId={userId} />,
    );

    await waitFor(() => {
      expect(getByText("Trabajo")).toBeTruthy();
    });

    const categories = await listCategories(db, userId);
    const catId = categories[0].id;

    await act(async () => {
      fireEvent.press(getByTestId(`btn-edit-cat-${catId}`));
    });

    await act(async () => {
      fireEvent.changeText(getByTestId("input-cat-name"), "Trabajo Urgente");
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-cat"));
    });

    expect(await findByTestId("category-manager-success")).toBeTruthy();
    expect(getByText("Trabajo Urgente")).toBeTruthy();

    const categoriesInDb = await listCategories(db, userId);
    expect(categoriesInDb[0].name).toBe("Trabajo Urgente");
  });
});
