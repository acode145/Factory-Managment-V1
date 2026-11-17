import { createPartyInwardAction } from "@/actions/fabric";
import { destroySession, getSession, signInWithPassword } from "@/lib/auth";
import { formatPakistanDate, parsePakistanDate } from "@/lib/dateUtils";
import { prisma } from "@/lib/prisma";

const path = "/legacy/inward";
const maxRows = 100;
const rowFields = ["fabricType", "colorShade", "unit", "rollCount", "challanQty", "measuredQty"] as const;
type Row = Record<(typeof rowFields)[number], string>;
type Draft = {
  challanDate: string;
  partyId: string;
  partyChallanNo: string;
  remarks: string;
  rows: Row[];
};

const blankRow: Row = {
  fabricType: "", colorShade: "", unit: "METERS",
  rollCount: "1", challanQty: "", measuredQty: "",
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function page(title: string, content: string, error = "", status = 200) {
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | Factory Management</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #f2f4f5; color: #182128; font: 16px/1.5 Arial, sans-serif; }
  main { max-width: 660px; margin: auto; padding: 20px 16px 48px; }
  h1 { font-size: 26px; margin: 0 0 12px; }
  h2 { font-size: 20px; }
  label { display: block; font-weight: bold; margin: 12px 0; }
  input, select, textarea, button { font: inherit; }
  input, select, textarea { display: block; width: 100%; min-height: 44px; padding: 8px; border: 1px solid #77838a; border-radius: 4px; background: #fff; color: inherit; }
  textarea { resize: vertical; }
  fieldset { min-width: 0; margin: 20px 0; padding: 0 14px 8px; border: 1px solid #adb6bc; background: #fff; }
  legend { padding: 0 5px; font-weight: bold; }
  button { min-height: 44px; margin: 6px 8px 6px 0; padding: 8px 14px; border: 1px solid #294553; border-radius: 4px; background: #fff; color: #173747; }
  .primary { background: #173747; color: #fff; font-weight: bold; }
  .error { padding: 10px; border-left: 4px solid #a52622; background: #fff0ee; }
  .success { padding: 10px; border-left: 4px solid #237250; background: #eaf7ef; }
  small { display: block; font-weight: normal; }
</style></head><body><main><h1>${title}</h1>
${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
${content}</main></body></html>`, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
  });
}

function loginPage(error = "") {
  return page("Sign in for inward receipts", `
    <form method="post" action="${path}">
      <input type="hidden" name="intent" value="login">
      <label>Username<input name="username" autocomplete="username" autocapitalize="none" required></label>
      <label>PIN or password<input name="password" type="password" autocomplete="current-password" required></label>
      <button class="primary">Sign in</button>
    </form>`, error, error ? 400 : 200);
}

function redirectToForm(igpNumber?: string) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: igpNumber ? `${path}?saved=${encodeURIComponent(igpNumber)}` : path,
      "Cache-Control": "private, no-store",
    },
  });
}

function readDraft(form: FormData): Draft {
  const value = (key: string) => String(form.get(key) ?? "");
  const columns = rowFields.map((field) => form.getAll(field).map(String));
  const count = Math.min(maxRows, columns[0].length);
  return {
    challanDate: value("challanDate"),
    partyId: value("partyId"),
    partyChallanNo: value("partyChallanNo"),
    remarks: value("remarks"),
    rows: Array.from({ length: count }, (_, i) => ({
      fabricType: columns[0][i] ?? "",
      colorShade: columns[1][i] ?? "",
      unit: columns[2][i] ?? "",
      rollCount: columns[3][i] ?? "",
      challanQty: columns[4][i] ?? "",
      measuredQty: columns[5][i] ?? "",
    })),
  };
}

async function receiptPage(userId: string, draft: Draft, error = "", savedNumber?: string) {
  const [parties, recent, saved] = await Promise.all([
    prisma.party.findMany({
      where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" },
    }),
    prisma.fabricInward.findMany({
      where: { receivedById: userId }, orderBy: { createdAt: "desc" }, take: 10,
      select: { igpNumber: true, challanDate: true, partyChallanNo: true, _count: { select: { items: true } } },
    }),
    savedNumber ? prisma.fabricInward.findFirst({
      where: { igpNumber: savedNumber, receivedById: userId },
      select: { igpNumber: true },
    }) : null,
  ]);

  const partyOptions = parties.map(({ id, name, code }) =>
    `<option value="${escapeHtml(id)}"${id === draft.partyId ? " selected" : ""}>${escapeHtml(`${name} (${code})`)}</option>`
  ).join("");
  const rows = draft.rows.map((row, index) => `
    <fieldset${index === draft.rows.length - 1 ? ' id="last-row"' : ""}>
      <legend>Fabric row ${index + 1}</legend>
      <label>Fabric type<input name="fabricType" value="${escapeHtml(row.fabricType)}" required></label>
      <label>Color or shade<input name="colorShade" value="${escapeHtml(row.colorShade)}" required></label>
      <label>Unit<select name="unit">
        ${[["METERS", "Meters"], ["YARDS", "Yards"], ["PIECES", "Pieces"]].map(([unit, label]) =>
          `<option value="${unit}"${unit === row.unit ? " selected" : ""}>${label}</option>`
        ).join("")}
      </select></label>
      <label>Roll or bundle count<input name="rollCount" value="${escapeHtml(row.rollCount)}" inputmode="numeric" required></label>
      <label>Challan quantity<input name="challanQty" value="${escapeHtml(row.challanQty)}" inputmode="decimal" required></label>
      <label>Measured quantity<input name="measuredQty" value="${escapeHtml(row.measuredQty)}" inputmode="decimal" required></label>
      ${draft.rows.length > 1 ? `<button name="intent" value="remove-${index}" formnovalidate>Remove row ${index + 1}</button>` : ""}
    </fieldset>`).join("");
  const history = recent.map((receipt) => `<li>
    <strong>${escapeHtml(receipt.igpNumber)}</strong> · ${formatPakistanDate(receipt.challanDate)} ·
    Challan ${escapeHtml(receipt.partyChallanNo)} · ${receipt._count.items} row${receipt._count.items === 1 ? "" : "s"}
  </li>`).join("");

  return page("Party Inward Receipt", `
    <form method="post" action="${path}"><button name="intent" value="logout">Sign out</button></form>
    ${saved ? `<p class="success" role="status">Receipt ${escapeHtml(saved.igpNumber)} saved. The party ledger was updated.</p>` : ""}
    ${partyOptions ? "" : "<p>No active parties are available. Ask the office to add the client party.</p>"}
    <form method="post" action="${path}" novalidate>
      <label>Receiving date <small>Enter day/month/year, for example 17/11/2026.</small>
        <input name="challanDate" value="${escapeHtml(draft.challanDate)}" placeholder="DD/MM/YYYY" required>
      </label>
      <label>Client party<select name="partyId" required>
        <option value="">Select a party</option>${partyOptions}
      </select></label>
      <label>Party challan or bilty number<input name="partyChallanNo" value="${escapeHtml(draft.partyChallanNo)}" required></label>
      <label>Remarks and vehicle info<textarea name="remarks" rows="2">${escapeHtml(draft.remarks)}</textarea></label>
      ${rows}
      <button class="primary" name="intent" value="save"${partyOptions ? "" : " disabled"}>Save Receipt</button>
      ${draft.rows.length < maxRows ? `<button name="intent" value="add" formaction="${path}#last-row" formnovalidate>Add Row</button>` : ""}
    </form>
    <h2>My recent receipts</h2>
    ${history ? `<ul>${history}</ul>` : "<p>No receipts yet.</p>"}`, error, error ? 400 : 200);
}

async function activeSession() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { isActive: true } });
  return user?.isActive ? session : null;
}

function sameOrigin(request: Request) {
  const source = request.headers.get("origin") ?? request.headers.get("referer");
  const target = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? target.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? target.protocol.slice(0, -1);
  try {
    return !!source && new URL(source).origin === `${protocol}://${host}`;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const session = await activeSession();
  if (!session) return loginPage();
  const savedNumber = new URL(request.url).searchParams.get("saved") ?? undefined;
  return receiptPage(session.userId, {
    challanDate: formatPakistanDate(new Date()),
    partyId: "", partyChallanNo: "", remarks: "", rows: [blankRow],
  }, "", savedNumber);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Open the receipt page and submit the form again.", { status: 403 });
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "save");
  if (intent === "login") {
    const result = await signInWithPassword(form);
    return "error" in result ? loginPage(result.error) : redirectToForm();
  }
  if (intent === "logout") {
    await destroySession();
    return redirectToForm();
  }

  const session = await activeSession();
  if (!session) return loginPage("Your session expired. Sign in to continue.");
  const draft = readDraft(form);
  if (intent === "add") {
    if (draft.rows.length < maxRows) draft.rows.push(blankRow);
    return receiptPage(session.userId, draft);
  }
  if (/^remove-\d+$/.test(intent)) {
    if (draft.rows.length > 1) draft.rows.splice(Number(intent.slice(7)), 1);
    return receiptPage(session.userId, draft);
  }
  if (intent !== "save") return new Response("Unknown action.", { status: 400 });

  const date = draft.challanDate.trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date) || formatPakistanDate(parsePakistanDate(date)) !== date) {
    return receiptPage(session.userId, draft, "Enter a valid receiving date in DD/MM/YYYY format.");
  }
  if (!draft.rows.length || form.getAll("fabricType").length > maxRows) {
    return receiptPage(session.userId, draft, `Enter between 1 and ${maxRows} fabric rows.`);
  }
  const party = await prisma.party.findFirst({ where: { id: draft.partyId, isActive: true }, select: { id: true } });
  if (!party) return receiptPage(session.userId, draft, "Select an active client party.");

  const payload = new FormData();
  const [day, month, year] = date.split("/");
  payload.set("challanDate", `${year}-${month}-${day}`);
  payload.set("partyId", draft.partyId);
  payload.set("partyChallanNo", draft.partyChallanNo);
  payload.set("remarks", draft.remarks);
  payload.set("itemsPayload", JSON.stringify(draft.rows));
  const result = await createPartyInwardAction(null, payload);
  return result.success
    ? redirectToForm(result.data?.igpNumber)
    : receiptPage(session.userId, draft, result.error ?? "Unable to save the receipt.");
}
