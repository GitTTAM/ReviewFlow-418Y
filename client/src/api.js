let csrfToken = "";
export async function apiRequest(path, { method = "GET", body, signal } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(method === "GET" ? {} : { "X-CSRF-Token": csrfToken }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (cause.name === "AbortError") throw cause;
    throw new Error(
      "Could not confirm the request. Your entries remain here. Reopen the last saved version before retrying a save.",
    );
  }
  const data = await response.json();
  if (!response.ok) {
    const error = Object.assign(new Error(data.message), {
      status: response.status,
      fields: data.fields || {},
    });
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("reviewflow:signed-out"));
    throw error;
  }
  if (data.csrfToken) csrfToken = data.csrfToken;
  window.dispatchEvent(new Event("reviewflow:activity"));
  return data;
}
export const getSession = () => apiRequest("/auth/session");
export const getReview = (id) => apiRequest(`/reviews/${id}`);
export const saveReview = (id, payload) =>
  apiRequest(`/reviews/${id}/save`, { method: "POST", body: payload });
export const getForms = () => apiRequest("/hr/forms");
export const getAssignments = () => apiRequest("/hr/assignments");
export const getAssignedReviews = () => apiRequest("/manager/reviews");
export const getEmployeeResults = () => apiRequest("/employee/results");
