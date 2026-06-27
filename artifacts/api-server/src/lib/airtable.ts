import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();

const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME ?? "Tasks";

function getBaseId(): string {
  const id = process.env.AIRTABLE_BASE_ID;
  if (!id) {
    throw new Error(
      "AIRTABLE_BASE_ID is not set. Add it as a secret in the environment settings.",
    );
  }
  return id;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`Airtable error (${response.status}): ${JSON.stringify(body)}`);
  }
  return body as T;
}

export const STATUS_OPEN = "Open";
export const STATUS_DONE = "Done";

export interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
}

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: {
    Title?: string;
    Priority?: string;
    Status?: string;
    "Due Date"?: string;
    Source?: string;
    Notes?: string;
    Tags?: string;
    Attachment?: AirtableAttachment[];
    "Attachment Summary"?: string;
    "Created at"?: string;
    [key: string]: unknown;
  };
}

export interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

export async function listRecords(filterFormula?: string): Promise<AirtableRecord[]> {
  const params = new URLSearchParams();
  if (filterFormula) {
    params.set("filterByFormula", filterFormula);
  }
  const url = `/v0/${getBaseId()}/${encodeURIComponent(TABLE_NAME)}?${params.toString()}`;
  const response = await connectors.proxy("airtable", url, { method: "GET" });
  const data = await parseResponse<AirtableListResponse>(response as unknown as Response);
  const records = data.records ?? [];
  return records.sort(
    (a, b) => new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime(),
  );
}

export async function getRecord(id: string): Promise<AirtableRecord> {
  const url = `/v0/${getBaseId()}/${encodeURIComponent(TABLE_NAME)}/${id}`;
  const response = await connectors.proxy("airtable", url, { method: "GET" });
  return parseResponse<AirtableRecord>(response as unknown as Response);
}

export interface CreateFields {
  title: string;
  priority?: string | null;
  source?: string | null;
}

export async function createRecord(fields: CreateFields): Promise<AirtableRecord> {
  const airtableFields: Record<string, unknown> = {
    Title: fields.title,
    Status: STATUS_OPEN,
  };
  if (fields.priority) airtableFields.Priority = fields.priority;
  if (fields.source) airtableFields.Source = fields.source;

  const url = `/v0/${getBaseId()}/${encodeURIComponent(TABLE_NAME)}`;
  const response = await connectors.proxy("airtable", url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: airtableFields }),
  });
  return parseResponse<AirtableRecord>(response as unknown as Response);
}

export interface UpdateFields {
  title?: string;
  completed?: boolean;
  flagged?: boolean;
  priority?: string | null;
  dueDate?: string | null;
  source?: string | null;
  notes?: string | null;
  tags?: string | null;
}

export async function updateRecord(id: string, patch: UpdateFields): Promise<AirtableRecord> {
  const fields: Record<string, unknown> = {};

  if (patch.title !== undefined) fields.Title = patch.title;
  if (patch.completed !== undefined) fields.Status = patch.completed ? STATUS_DONE : STATUS_OPEN;
  if (patch.notes !== undefined) fields.Notes = patch.notes ?? "";
  if (patch.tags !== undefined) fields.Tags = patch.tags ?? "";
  if (patch.source !== undefined) fields.Source = patch.source ?? "";
  if (patch.dueDate !== undefined) fields["Due Date"] = patch.dueDate ?? null;

  // flagged overrides priority: true → "High", false → clear
  if (patch.flagged !== undefined) {
    fields.Priority = patch.flagged ? "High" : "";
  } else if (patch.priority !== undefined) {
    fields.Priority = patch.priority ?? "";
  }

  const url = `/v0/${getBaseId()}/${encodeURIComponent(TABLE_NAME)}/${id}`;
  const response = await connectors.proxy("airtable", url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  return parseResponse<AirtableRecord>(response as unknown as Response);
}

export async function deleteRecord(id: string): Promise<void> {
  const url = `/v0/${getBaseId()}/${encodeURIComponent(TABLE_NAME)}/${id}`;
  const response = await connectors.proxy("airtable", url, { method: "DELETE" });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(`Airtable error (${response.status}): ${JSON.stringify(body)}`);
  }
}
