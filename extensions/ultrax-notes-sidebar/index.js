const initializeNotes = () => {
  const textarea = document.querySelector("#notes");
  const status = document.querySelector("#status");

  const setStatus = (message) => {
    if (status) {
      status.textContent = message;
    }
  };

  const save = async () => {
    try {
      await window.ultrax.storage.set("notes", textarea.value);
      setStatus("Saved locally in UltraX extension storage.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.");
    }
  };

  void window.ultrax.storage.get("notes").then((value) => {
    textarea.value = typeof value === "string" ? value : "";
    setStatus("Ready.");
  });

  textarea.addEventListener("input", () => {
    setStatus("Unsaved changes");
  });

  document.querySelector("#save")?.addEventListener("click", () => {
    void save();
  });

  document.querySelector("#clear")?.addEventListener("click", () => {
    textarea.value = "";
    void window.ultrax.storage.remove("notes").then(() => setStatus("Cleared."));
  });
};

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initializeNotes, { once: true });
} else {
  initializeNotes();
}
