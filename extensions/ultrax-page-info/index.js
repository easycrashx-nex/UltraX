const initializePageInfo = () => {
  const title = document.querySelector("#title");
  const url = document.querySelector("#url");
  const tabCount = document.querySelector("#tab-count");
  const status = document.querySelector("#status");

  const render = async () => {
    try {
      const [activeTab, tabs] = await Promise.all([
        window.ultrax.tabs.getActive(),
        window.ultrax.tabs.query(),
      ]);

      title.textContent = activeTab?.title || "No active tab";
      url.textContent = activeTab?.url || "No URL";
      tabCount.textContent = String(tabs.length);
      status.textContent = "Updated from UltraX Extension API v1.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Could not read tab info.";
    }
  };

  document.querySelector("#refresh")?.addEventListener("click", () => {
    void render();
  });

  void render();
};

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initializePageInfo, { once: true });
} else {
  initializePageInfo();
}
