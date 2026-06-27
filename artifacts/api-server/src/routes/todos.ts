import { Router } from "express";
import {
  ListTodosQueryParams,
  CreateTodoBody,
  UpdateTodoParams,
  UpdateTodoBody,
  DeleteTodoParams,
} from "@workspace/api-zod";
import {
  listRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "../lib/airtable.js";

const router = Router();

function toTodo(record: AirtableRecord) {
  return {
    id: record.id,
    title: record.fields.Name ?? "",
    completed: record.fields.Completed ?? false,
    createdAt: record.createdTime,
  };
}

router.get("/todos", async (req, res) => {
  try {
    const query = ListTodosQueryParams.parse(req.query);
    let filterFormula: string | undefined;

    if (query.status === "active") {
      filterFormula = "NOT({Completed})";
    } else if (query.status === "completed") {
      filterFormula = "{Completed}";
    }

    const records = await listRecords(filterFormula);
    res.json(records.map(toTodo));
  } catch (err) {
    req.log.error({ err }, "Failed to list todos");
    res.status(500).json({ error: "Failed to list todos" });
  }
});

router.get("/todos/stats", async (req, res) => {
  try {
    const records = await listRecords();
    const total = records.length;
    const completed = records.filter((r) => r.fields.Completed).length;
    const active = total - completed;
    res.json({ total, active, completed });
  } catch (err) {
    req.log.error({ err }, "Failed to get todo stats");
    res.status(500).json({ error: "Failed to get todo stats" });
  }
});

router.post("/todos", async (req, res) => {
  try {
    const body = CreateTodoBody.parse(req.body);
    const record = await createRecord({ Name: body.title, Completed: false });
    res.status(201).json(toTodo(record));
  } catch (err) {
    req.log.error({ err }, "Failed to create todo");
    res.status(500).json({ error: "Failed to create todo" });
  }
});

router.patch("/todos/:id", async (req, res) => {
  try {
    const { id } = UpdateTodoParams.parse(req.params);
    const body = UpdateTodoBody.parse(req.body);

    const fields: Partial<{ Name: string; Completed: boolean }> = {};
    if (body.title !== undefined) fields.Name = body.title;
    if (body.completed !== undefined) fields.Completed = body.completed;

    const record = await updateRecord(id, fields);
    res.json(toTodo(record));
  } catch (err) {
    req.log.error({ err }, "Failed to update todo");
    res.status(500).json({ error: "Failed to update todo" });
  }
});

router.delete("/todos/:id", async (req, res) => {
  try {
    const { id } = DeleteTodoParams.parse(req.params);
    await deleteRecord(id);
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete todo");
    res.status(500).json({ error: "Failed to delete todo" });
  }
});

export default router;
