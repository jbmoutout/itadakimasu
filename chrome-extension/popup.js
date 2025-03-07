// Configuration
const API_URL = "https://itadakimasu.vercel.app/api"; // Production URL

// DOM Elements
const bookmarkList = document.getElementById("bookmarkList");
const importButton = document.getElementById("importButton");
const status = document.getElementById("status");
const selectAllCheckbox = document.getElementById("selectAll");

// State
let bookmarks = [];
let selectedBookmarks = new Set();
let existingRecipes = new Set(); // Store existing recipe URLs

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Popup initialized");
  try {
    // Check if user is logged in first by checking both storage areas
    console.log("Checking storage for token...");
    const [localToken, syncToken] = await Promise.all([
      new Promise((resolve) =>
        chrome.storage.local.get("token", (result) => {
          console.log("Local storage result:", result);
          resolve(result.token);
        })
      ),
      new Promise((resolve) =>
        chrome.storage.sync.get("token", (result) => {
          console.log("Sync storage result:", result);
          resolve(result.token);
        })
      ),
    ]);

    console.log("Storage check complete:", { localToken, syncToken });
    const token = localToken || syncToken;

    if (!token) {
      console.log("No token found in either storage");
      status.textContent = "Please log in to Itadakimasu first";
      importButton.disabled = true;
      selectAllCheckbox.disabled = true;
      return;
    }

    console.log("Token found:", token.slice(0, 10) + "...");

    // Store token in local storage if it was in sync
    if (!localToken && syncToken) {
      console.log("Copying token from sync to local storage");
      chrome.storage.local.set({ token: syncToken });
    }

    // Fetch existing recipes for the user
    try {
      console.log("Fetching recipes from:", `${API_URL}/recipes`);
      const response = await fetch(`${API_URL}/recipes`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        mode: "cors",
      });

      console.log("Response status:", response.status);
      console.log(
        "Response headers:",
        Object.fromEntries(response.headers.entries())
      );

      if (response.ok) {
        const recipes = await response.json();
        console.log("Recipes fetched:", recipes.length);
        existingRecipes = new Set(recipes.map((recipe) => recipe.url));
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to fetch recipes:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData.error || "Unknown error",
          headers: Object.fromEntries(response.headers.entries()),
        });

        // Handle JWT expired error
        if (errorData.error?.includes("JWTExpired")) {
          // Clear token from both storage areas
          await Promise.all([
            chrome.storage.local.remove("token"),
            chrome.storage.sync.remove("token"),
          ]);
          status.textContent =
            "Your session has expired. Please log in to Itadakimasu again.";
          importButton.disabled = true;
          selectAllCheckbox.disabled = true;
          return;
        }

        status.textContent = `Error fetching recipes: ${
          errorData.error || response.statusText || "Unknown error"
        }`;
        importButton.disabled = true;
        selectAllCheckbox.disabled = true;
        return;
      }
    } catch (error) {
      console.error("Error fetching existing recipes:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      status.textContent = `Error connecting to Itadakimasu: ${error.message}`;
      importButton.disabled = true;
      selectAllCheckbox.disabled = true;
      return;
    }

    // Get bookmarks from Chrome
    const tree = await chrome.bookmarks.getTree();
    console.log("Full bookmark tree:", JSON.stringify(tree, null, 2));

    const allBookmarks = findMiamBookmarks(tree);
    console.log("Found MIAM bookmarks:", allBookmarks);

    // Filter out already saved bookmarks
    bookmarks = allBookmarks.filter(
      (bookmark) => !existingRecipes.has(bookmark.url)
    );
    console.log("New bookmarks to import:", bookmarks);

    if (bookmarks.length === 0) {
      status.textContent =
        existingRecipes.size > 0
          ? "All bookmarks from MIAM folder are already saved"
          : "No bookmarks found in the MIAM folder";
      importButton.disabled = true;
      selectAllCheckbox.disabled = true;
      return;
    }

    // Render bookmarks
    renderBookmarks();
  } catch (error) {
    console.error("Error loading bookmarks:", error);
    status.textContent = "Error loading bookmarks";
  }
});

// Event Listeners
importButton.addEventListener("click", importSelectedBookmarks);
selectAllCheckbox?.addEventListener("change", (e) => {
  if (e.target.checked) {
    // Select all bookmarks
    bookmarks.forEach((bookmark) => selectedBookmarks.add(bookmark.id));
  } else {
    // Deselect all bookmarks
    selectedBookmarks.clear();
  }
  renderBookmarks();
  importButton.disabled = selectedBookmarks.size === 0;
});

// Helper Functions
function findMiamBookmarks(nodes) {
  // First, find the bookmark bar
  const bookmarkBar = nodes[0]?.children?.find((node) => node.id === "1");
  console.log("Bookmark bar:", bookmarkBar);

  if (!bookmarkBar) {
    console.log("Bookmark bar not found");
    return [];
  }

  // Then find the MIAM folder
  const miamFolder = bookmarkBar.children?.find(
    (node) => node.title === "MIAM"
  );
  console.log("MIAM folder:", miamFolder);

  if (!miamFolder) {
    console.log("MIAM folder not found");
    return [];
  }

  // Get all bookmarks from the MIAM folder
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
  // Update select all checkbox state
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

  // Add event listeners to checkboxes
  document.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    if (checkbox.id === "selectAll") return; // Skip the select all checkbox
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        selectedBookmarks.add(e.target.id);
      } else {
        selectedBookmarks.delete(e.target.id);
      }
      // Update select all checkbox state
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

    const token = await chrome.storage.local.get("token");
    if (!token.token) {
      throw new Error("Not logged in");
    }

    const selectedRecipes = bookmarks.filter((b) =>
      selectedBookmarks.has(b.id)
    );
    let successCount = 0;
    let errorCount = 0;
    let ingredientErrorCount = 0;

    for (const recipe of selectedRecipes) {
      try {
        // First, add the recipe
        const addResponse = await fetch(`${API_URL}/add-recipe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token.token}`,
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

        // Then, trigger ingredient extraction and wait for it to complete
        const extractResponse = await fetch(`${API_URL}/extract-ingredients`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token.token}`,
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
          // Read the stream to ensure it completes
          const reader = extractResponse.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            // Convert the chunk to text
            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const data = JSON.parse(line);
                  if (data.log) {
                    console.log("Extraction log:", data.log);
                  }
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

        // Finally, trigger metadata fetching
        const metadataResponse = await fetch(
          `${API_URL}/preview-metadata?url=${encodeURIComponent(
            recipe.url
          )}&recipeId=${newRecipe.id}`,
          {
            headers: {
              Authorization: `Bearer ${token.token}`,
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
