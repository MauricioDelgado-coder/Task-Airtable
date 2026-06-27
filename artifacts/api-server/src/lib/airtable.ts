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

// Field mapping for the "To Do" table:
//   Title  → singleLineText (primary field)
//   Status → singleSelect ("Open" | "Done")
export const FIELD_TITLE = "Title";
export const FIELD_STATUS = "Status";
export const STATUS_OPEN = "Open";
export const STATUS_DONE = "Done";

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: {
    Title?: string;
    Status?: string;
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

export async function createRecord(title: string): Promise<AirtableRecord> {
  const url = `/v0/${getBaseId()}/${encodeURIComponent(TABLE_NAME)}`;
  const response = await connectors.proxy("airtable", url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { [FIELD_TITLE]: title, [FIELD_STATUS]: STATUS_OPEN } }),
  });
  return parseResponse<AirtableRecord>(response as unknown as Response);
}

export async function updateRecord(
  id: string,
  patch: { title?: string; completed?: boolean },
): Promise<AirtableRecord> {
  const fields: Record<string, string> = {};
  if (patch.title !== undefined) fields[FIELD_TITLE] = patch.title;
  if (patch.completed !== undefined) fields[FIELD_STATUS] = patch.completed ? STATUS_DONE : STATUS_OPEN;

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
