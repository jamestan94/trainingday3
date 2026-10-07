"use client";

import { useEffect, useMemo, useState } from "react";

type Expense = {
  id: number;
  description: string;
  amount: number;
  category: string;
};

const categoryOptions = [
  "Food",
  "Transport",
  "Housing",
  "Utilities",
  "Health",
  "Entertainment",
  "Other",
];

const demoCredentials = {
  username: "james",
  password: "12345",
};

const AUTH_STORAGE_KEY = "expense-tracker-auth";
const EXPENSES_STORAGE_KEY = "expense-tracker-expenses";

const fallbackExpenses: Expense[] = [
  { id: 1, description: "Groceries", amount: 42.5, category: "Food" },
  { id: 2, description: "Train pass", amount: 28.0, category: "Transport" },
  { id: 3, description: "Electric bill", amount: 96.2, category: "Utilities" },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

export default function ExpenseTracker() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>(fallbackExpenses);
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category: "Food",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    const storedLogin = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedLogin === "true") {
      setIsLoggedIn(true);
    }

    const storedExpenses = window.localStorage.getItem(EXPENSES_STORAGE_KEY);
    if (storedExpenses) {
      try {
        const parsedExpenses = JSON.parse(storedExpenses);
        if (Array.isArray(parsedExpenses) && parsedExpenses.length > 0) {
          setExpenses(parsedExpenses);
        }
      } catch {
        window.localStorage.removeItem(EXPENSES_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_STORAGE_KEY, String(isLoggedIn));
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(expenses));
    }
  }, [expenses]);

  useEffect(() => {
    if (!isLoggedIn) return;

    async function loadExpenses() {
      try {
        const response = await fetch("/api/expenses");
        if (!response.ok) {
          throw new Error("Could not load expenses");
        }

        const data = await response.json();
        const nextExpenses = Array.isArray(data) ? data : fallbackExpenses;
        setExpenses(nextExpenses);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(nextExpenses));
        }
      } catch {
        const savedExpenses = window.localStorage.getItem(EXPENSES_STORAGE_KEY);
        if (savedExpenses) {
          try {
            const parsed = JSON.parse(savedExpenses);
            if (Array.isArray(parsed)) setExpenses(parsed);
          } catch {
            setExpenses(fallbackExpenses);
          }
        } else {
          setExpenses(fallbackExpenses);
        }
      }
    }

    loadExpenses();
  }, [isLoggedIn]);

  const totalSpent = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [expenses],
  );

  const averagePerEntry = expenses.length === 0 ? 0 : totalSpent / expenses.length;

  const categoryBreakdown = useMemo(() => {
    const counts = expenses.reduce<Record<string, number>>((result, expense) => {
      result[expense.category] = (result[expense.category] ?? 0) + 1;
      return result;
    }, {});

    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const handleLoginChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const { name, value } = event.target;
    setLoginForm((current) => ({ ...current, [name]: value }));
    if (loginError) setLoginError("");
  };

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const isValidUser =
      loginForm.username === demoCredentials.username &&
      loginForm.password === demoCredentials.password;

    if (!isValidUser) {
      setLoginError("Invalid credentials. Use james / 12345.");
      return;
    }

    setIsLoggedIn(true);
    setLoginForm({ username: "", password: "" });
    setLoginError("");
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    if (error) setError("");
  };

  const handleAddExpense = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isLoggedIn) {
      setError("Please sign in to add an expense.");
      return;
    }

    const description = formData.description.trim();
    const amount = Number(formData.amount);

    if (!description) {
      setError("Description is required.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          amount: Number(amount.toFixed(2)),
          category: formData.category || "Other",
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not save expense");
      }

      setExpenses((current) => [payload, ...current]);
      setFormData({ description: "", amount: "", category: formData.category });
      setError("");
    } catch (addError) {
      const optimisticExpense: Expense = {
        id: Date.now() + Math.random(),
        description,
        amount: Number(amount.toFixed(2)),
        category: formData.category || "Other",
      };

      setExpenses((current) => [optimisticExpense, ...current]);
      setFormData({ description: "", amount: "", category: formData.category });
      setError("");

      console.error(addError);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!isLoggedIn) {
      setError("Please sign in to delete an expense.");
      return;
    }

    try {
      const response = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not delete expense");
      }

      setExpenses((current) => current.filter((expense) => expense.id !== id));
      setError("");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Could not delete expense.",
      );
    }
  };

  if (!isLoggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-slate-950/40">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-emerald-400">
            Secure access
          </p>
          <h1 className="mt-4 text-3xl font-bold text-white">Sign in</h1>
          <p className="mt-2 text-sm text-slate-400">
            Use your account to manage expenses and protected actions.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-200">
              Username
              <input
                type="text"
                name="username"
                value={loginForm.username}
                onChange={handleLoginChange}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                placeholder="james"
              />
            </label>

            <label className="block text-sm font-medium text-slate-200">
              Password
              <input
                type="password"
                name="password"
                value={loginForm.password}
                onChange={handleLoginChange}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                placeholder="12345"
              />
            </label>

            {loginError ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {loginError}
              </div>
            ) : null}

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              Log in
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-emerald-400">
              Mini Expense Tracker
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Track spending in real time
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
                Running total
              </p>
              <p className="mt-2 text-3xl font-bold text-emerald-300">
                {formatCurrency(totalSpent)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsLoggedIn(false);
                if (typeof window !== "undefined") {
                  window.localStorage.removeItem(AUTH_STORAGE_KEY);
                }
              }}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500"
            >
              Log out
            </button>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form
            onSubmit={handleAddExpense}
            className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-slate-950/30"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Add expense</h2>
              <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-300">
                Secure action
              </span>
            </div>

            <div className="space-y-5">
              <label className="block text-sm font-medium text-slate-200">
                Description
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Coffee, rent, flights..."
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                />
              </label>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-200">
                  Amount
                  <input
                    type="number"
                    name="amount"
                    min="0.01"
                    step="0.01"
                    value={formData.amount}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-200">
                  Category
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {categoryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {error ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                Save expense
              </button>
            </div>
          </form>

          <aside className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-slate-950/30">
            <h2 className="text-xl font-semibold text-white">Stats</h2>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Total spent
                </p>
                <p className="mt-3 text-2xl font-bold text-white">
                  {formatCurrency(totalSpent)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Avg / entry
                </p>
                <p className="mt-3 text-2xl font-bold text-white">
                  {formatCurrency(averagePerEntry)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Entries by category
              </p>
              <div className="mt-4 space-y-3">
                {categoryBreakdown.length === 0 ? (
                  <p className="text-sm text-slate-400">No expenses logged yet.</p>
                ) : (
                  categoryBreakdown.map(([category, count]) => (
                    <div key={category} className="space-y-1">
                      <div className="flex items-center justify-between text-sm text-slate-200">
                        <span>{category}</span>
                        <span>{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-sky-400"
                          style={{
                            width: `${(count / Math.max(expenses.length, 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-slate-950/30">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-white">Expense history</h2>
            <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-sm text-slate-300">
              {expenses.length} {expenses.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          {expenses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center text-slate-400">
              No expenses logged yet. Add the first one above.
            </div>
          ) : (
            <ul className="space-y-3">
              {expenses.map((expense) => (
                <li
                  key={expense.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold text-white">
                        {expense.description}
                      </p>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
                        {expense.category}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                      Logged as a valid expense entry
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <p className="text-lg font-bold text-emerald-300">
                      {formatCurrency(expense.amount)}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(expense.id)}
                      className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
