import { createExpense, getAllExpenses } from "../../../lib/db";

export async function GET() {
  try {
    const expenses = await getAllExpenses();
    return Response.json(expenses);
  } catch (error) {
    console.error("GET /api/expenses failed:", error);
    return Response.json({ error: "Could not load expenses" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const expense = await createExpense(payload);
    return Response.json(expense, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create expense";

    if (message === "Description is required" || message === "Amount must be a positive number") {
      return Response.json({ error: message }, { status: 400 });
    }

    console.error("POST /api/expenses failed:", error);
    return Response.json({ error: "Could not create expense" }, { status: 500 });
  }
}
