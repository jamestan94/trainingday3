import { deleteExpense } from "../../../../lib/db";

export async function DELETE(request, context) {
  try {
    const { params } = context;
    const resolvedParams = await params;
    const id = Number(resolvedParams.id);

    if (!Number.isFinite(id) || id <= 0) {
      return Response.json({ error: "Expense id must be a number" }, { status: 400 });
    }

    const removed = await deleteExpense(id);

    if (!removed) {
      return Response.json({ error: "Expense not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/expenses/[id] failed:", error);
    return Response.json({ error: "Could not delete expense" }, { status: 500 });
  }
}
