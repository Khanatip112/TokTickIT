import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");

  async function handleCheck() {
    setState("loading");
    setErrorMessage("");
    try {
      const status = await checkSystem();
      setCategories(status.categories);
      setState("success");
    } catch (err: any) {
      setErrorMessage(err.message || "Unable to connect to TokTickIT API");
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success mb-4" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "success" && (
        <div className="mt-3">
          <p className="fw-bold mb-3">System Status: <span className="text-success">Online</span></p>
          {categories.length > 0 && (
            <div>
              <p className="fw-bold mb-2">Supported Request Categories:</p>
              <table className="table table-bordered table-striped mt-2">
                <thead>
                  <tr>
                    <th>Category ID</th>
                    <th>Category Name</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.id}>
                      <td>{cat.id}</td>
                      <td>{cat.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {state === "error" && (
        <div className="mt-3">
          <p className="fw-bold mb-1 text-danger">System Status: Offline</p>
          <p className="text-muted">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}