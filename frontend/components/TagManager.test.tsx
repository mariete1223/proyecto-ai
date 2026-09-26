import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { createLocalCategory } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { createLocalEntry } from "../db/entries";
import { createLocalTag, listTags } from "../db/tags";
import { TagManager } from "./TagManager";

describe("TagManager Component", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-789";

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    const tag = await createLocalTag(db, userId, { name: "Prioritario" });

    const cat = await createLocalCategory(db, userId, {
      name: "Notas",
      voice_command: "nota",
    });

    // Create entry using the tag
    await createLocalEntry(db, userId, {
      category_id: cat.id,
      content: "Entrada con tag",
      tag_ids: [tag.id],
    });
  });

  it("renders existing tags and usage count", async () => {
    const { getByTestId, getByText } = await render(
      <TagManager db={db} userId={userId} />,
    );

    await waitFor(() => {
      expect(getByTestId("tag-manager")).toBeTruthy();
      expect(getByText("#Prioritario")).toBeTruthy();
      expect(getByText("En uso: 1")).toBeTruthy();
    });
  });

  it("validates empty tag name on submit", async () => {
    const { getByTestId, getByText } = await render(
      <TagManager db={db} userId={userId} />,
    );

    await waitFor(() => {
      expect(getByText("#Prioritario")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-tag"));
    });

    await waitFor(() => {
      expect(getByTestId("tag-manager-error")).toBeTruthy();
      expect(
        getByText("El nombre de la etiqueta no puede estar vacío."),
      ).toBeTruthy();
    });
  });

  it("creates a new tag successfully", async () => {
    const onChangedMock = jest.fn();
    const { getByTestId, getByText, findByTestId } = await render(
      <TagManager db={db} userId={userId} onTagChanged={onChangedMock} />,
    );

    await waitFor(() => {
      expect(getByText("#Prioritario")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.changeText(getByTestId("input-tag-name"), "urgente");
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-tag"));
    });

    expect(await findByTestId("tag-manager-success")).toBeTruthy();
    expect(getByText("#urgente")).toBeTruthy();
    expect(onChangedMock).toHaveBeenCalledTimes(1);

    const tagsInDb = await listTags(db, userId);
    expect(tagsInDb.some((t) => t.name === "urgente")).toBe(true);
  });

  it("edits an existing tag successfully", async () => {
    const { getByTestId, getByText, findByTestId } = await render(
      <TagManager db={db} userId={userId} />,
    );

    await waitFor(() => {
      expect(getByText("#Prioritario")).toBeTruthy();
    });

    const tags = await listTags(db, userId);
    const tagId = tags[0].id;

    await act(async () => {
      fireEvent.press(getByTestId(`btn-edit-tag-${tagId}`));
    });

    await act(async () => {
      fireEvent.changeText(getByTestId("input-tag-name"), "AltaPrioridad");
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-tag"));
    });

    expect(await findByTestId("tag-manager-success")).toBeTruthy();
    expect(getByText("#AltaPrioridad")).toBeTruthy();

    const tagsInDb = await listTags(db, userId);
    expect(tagsInDb[0].name).toBe("AltaPrioridad");
  });

  it("prompts warning and deletes tag when confirmed", async () => {
    const { getByTestId, getByText, findByTestId } = await render(
      <TagManager db={db} userId={userId} />,
    );

    await waitFor(() => {
      expect(getByText("#Prioritario")).toBeTruthy();
    });

    const tags = await listTags(db, userId);
    const tagId = tags[0].id;

    await act(async () => {
      fireEvent.press(getByTestId(`btn-delete-tag-${tagId}`));
    });

    await waitFor(() => {
      expect(getByTestId("tag-delete-confirm-box")).toBeTruthy();
      expect(
        getByText(
          "Esta etiqueta se encuentra en uso en 1 entrada(s). Si la eliminas, se desvinculará de ellas.",
        ),
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-confirm-delete-tag"));
    });

    expect(await findByTestId("tag-manager-success")).toBeTruthy();
    const tagsInDb = await listTags(db, userId);
    expect(tagsInDb.length).toBe(0);
  });
});
