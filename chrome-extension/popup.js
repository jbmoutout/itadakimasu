// Configuration
const API_URL = "https://itadakimasu.vercel.app/api"; // Production URL

// DOM Elements
const loginView = document.getElementById("loginView");
const importView = document.getElementById("importView");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginButton = document.getElementById("loginButton");
const loginStatus = document.getElementById("loginStatus");
const logoutButton = document.getElementById("logoutButton");
const bookmarkList = document.getElementById("bookmarkList");
const importButton = document.getElementById("importButton");
const status = document.getElementById("status");
const selectAllCheckbox = document.getElementById("selectAll");

// State
let bookmarks = [];
let selectedBookmarks = new Set();
let existingRecipes = new Set();

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  const token = await readToken();
  if (token) {
    await showImportView(token);
  } else {
    showLoginView();
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginButton.disabled = true;
  loginStatus.textContent = "Signing in...";

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: loginEmail.value,
        password: loginPassword.value,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Sign-in failed");
    }

    const { token } = await response.json();
    if (!token) throw new Error("No token returned");

    await chrome.storage.local.set({ token });
    loginStatus.textContent = "";
    await showImportView(token);
  } catch (error) {
    console.error("Login error:", error);
    loginStatus.textContent = error.message || "Sign-in failed";
  } finally {
    loginButton.disabled = false;
  }
});

logoutButton?.addEventListener("click", async () => {
  await chrome.storage.local.remove("token");
  await chrome.storage.sync.remove("token");
  showLoginView();
});

importButton.addEventListener("click", importSelectedBookmarks);
selectAllCheckbox?.addEventListener("change", (e) => {
  if (e.target.checked) {
    bookmarks.forEach((bookmark) => selectedBookmarks.add(bookmark.id));
  } else {
    selectedBookmarks.clear();
  }
  renderBookmarks();
  importButton.disabled = selectedBookmarks.size === 0;
});

// Views
function showLoginView() {
  loginView.classList.remove("hidden");
  importView.classList.add("hidden");
  loginEmail.value = "";
  loginPassword.value = "";
}

async function showImportView(token) {
  loginView.classList.add("hidden");
  importView.classList.remove("hidden");
  await loadBookmarks(token);
}

async function readToken() {
  const [localResult, syncResult] = await Promise.all([
    chrome.storage.local.get("token"),
    chrome.storage.sync.get("token"),
  ]);
  const token = localResult.token || syncResult.token;
  if (!token) return null;
  if (!localResult.token && syncResult.token) {
    await chrome.storage.local.set({ token: syncResult.token });
  }
  return token;
}

async function loadBookmarks(token) {
  status.textContent = "Loading…";
  importButton.disabled = true;
  selectAllCheckbox.disabled = true;

  try {
    const response = await fetch(`${API_URL}/recipes`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      mode: "cors",
    });

    if (response.status === 401) {
      await chrome.storage.local.remove("token");
      await chrome.storage.sync.remove("token");
      showLoginView();
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      status.textContent = `Error fetching recipes: ${
        errorData.error || response.statusText || "Unknown error"
      }`;
      return;
    }

    const data = await response.json();
    const recipes = Array.isArray(data) ? data : data.recipes || [];
    existingRecipes = new Set(recipes.map((recipe) => recipe.url));
  } catch (error) {
    console.error("Error fetching existing recipes:", error);
    status.textContent = `Error connecting to Itadakimasu: ${error.message}`;
    return;
  }

  const tree = await chrome.bookmarks.getTree();
  const allBookmarks = findMiamBookmarks(tree);
  bookmarks = allBookmarks.filter(
    (bookmark) => !existingRecipes.has(bookmark.url)
  );

  if (bookmarks.length === 0) {
    status.textContent =
      existingRecipes.size > 0
        ? "All bookmarks from MIAM folder are already saved"
        : "No bookmarks found in the MIAM folder";
    return;
  }

  selectAllCheckbox.disabled = false;
  status.textContent = "";
  renderBookmarks();
}

// Helper Functions
function findMiamBookmarks(nodes) {
  const bookmarkBar = nodes[0]?.children?.find((node) => node.id === "1");
  if (!bookmarkBar) return [];

  const miamFolder = bookmarkBar.children?.find(
    (node) => node.title === "MIAM"
  );
  if (!miamFolder) return [];

  return flattenBookmarks([miamFolder]);
}

function flattenBookmarks(nodes) {
  let bookmarks = [];
  for (const node of nodes) {
    if (node.url) {
      bookmarks.push({
        id: node.id,
        title: node.title,
        url: node.url,
      });
    }
    if (node.children) {
      bookmarks = bookmarks.concat(flattenBookmarks(node.children));
    }
  }
  return bookmarks;
}

function renderBookmarks() {
  if (selectAllCheckbox) {
    selectAllCheckbox.checked =
      bookmarks.length > 0 && selectedBookmarks.size === bookmarks.length;
  }

  bookmarkList.innerHTML = bookmarks
    .map(
      (bookmark) => `
    <div class="bookmark-item">
      <input type="checkbox" id="${bookmark.id}" ${
        selectedBookmarks.has(bookmark.id) ? "checked" : ""
      }>
      <label for="${bookmark.id}">${bookmark.title}</label>
    </div>
  `
    )
    .join("");

  document.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    if (checkbox.id === "selectAll") return;
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        selectedBookmarks.add(e.target.id);
      } else {
        selectedBookmarks.delete(e.target.id);
      }
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = selectedBookmarks.size === bookmarks.length;
      }
      importButton.disabled = selectedBookmarks.size === 0;
    });
  });
}

async function importSelectedBookmarks() {
  try {
    importButton.disabled = true;
    status.textContent = "Importing recipes...";

    const stored = await chrome.storage.local.get("token");
    const token = stored.token;
    if (!token) {
      showLoginView();
      return;
    }

    const selectedRecipes = bookmarks.filter((b) =>
      selectedBookmarks.has(b.id)
    );
    let successCount = 0;
    let errorCount = 0;
    let ingredientErrorCount = 0;

    for (const recipe of selectedRecipes) {
      try {
        const addResponse = await fetch(`${API_URL}/add-recipe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            url: recipe.url,
            title: recipe.title,
          }),
        });

        if (!addResponse.ok) {
          const data = await addResponse.json();
          if (data.error === "You have already saved this recipe") {
            successCount++;
            continue;
          }
          throw new Error(data.error || "Failed to add recipe");
        }

        const { recipe: newRecipe } = await addResponse.json();

        const extractResponse = await fetch(`${API_URL}/extract-ingredients`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            recipeId: newRecipe.id,
          }),
        });

        if (!extractResponse.ok) {
          const errorText = await extractResponse.text();
          console.error("Failed to extract ingredients:", errorText);
          ingredientErrorCount++;
        } else {
          const reader = extractResponse.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const data = JSON.parse(line);
                  if (data.error) {
                    console.error("Extraction error:", data.error);
                    ingredientErrorCount++;
                  }
                } catch (e) {
                  console.error("Error parsing stream data:", e);
                }
              }
            }
          }
        }

        const metadataResponse = await fetch(
          `${API_URL}/preview-metadata?url=${encodeURIComponent(
            recipe.url
          )}&recipeId=${newRecipe.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!metadataResponse.ok) {
          console.error(
            "Failed to fetch metadata:",
            await metadataResponse.text()
          );
        }

        successCount++;
      } catch (error) {
        console.error("Error importing recipe:", error);
        errorCount++;
      }
    }

    status.textContent = `Import complete: ${successCount} successful, ${errorCount} failed, ${ingredientErrorCount} ingredient extraction errors`;
    selectedBookmarks.clear();
    renderBookmarks();
  } catch (error) {
    console.error("Error during import:", error);
    status.textContent = "Error importing recipes";
  } finally {
    importButton.disabled = false;
  }
}
