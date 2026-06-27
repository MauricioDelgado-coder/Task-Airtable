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

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: {
    Name?: string;
    Completed?: boolean;
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
  params.set("sort[0][field]", "Created");
  params.set("sort[0][direction]", "asc");

  const url = `/v0/${getBaseId()}/${encodeURIComponent(TABLE_NAME)}?${params.toString()}`;
  const response = await connectors.proxy("airtable", url, { method: "GET" });
  const data = (await response.json()) as AirtableListResponse;
  return data.records ?? [];
}

export async function createRecord(fields: { Name: string; Completed: boolean }): Promise<AirtableRecord> {
  const url = `/v0/${getBaseId()}/${encodeURIComponent(TABLE_NAME)}`;
  const response = await connectors.proxy("airtable", url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  return (await response.json()) as AirtableRecord;
}

export async function updateRecord(
  id: string,
  fields: Partial<{ Name: string; Completed: boolean }>,
): Promise<AirtableRecord> {
  const url = `/v0/${getBaseId()}/${encodeURIComponent(TABLE_NAME)}/${id}`;
  const response = await connectors.proxy("airtable", url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  return (await response.json()) as AirtableRecord;
}

export async function deleteRecord(id: string): Promise<void> {
  const url = `/v0/${getBaseId()}/${encodeURIComponent(TABLE_NAME)}/${id}`;
  await connectors.proxy("airtable", url, { method: "DELETE" });
}
