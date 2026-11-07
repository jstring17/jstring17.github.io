const libraries = new Map();
let chartId = 0;

function loadScript(src, integrity) {
  if (!libraries.has(src)) {
    libraries.set(
      src,
      new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.integrity = integrity;
        script.crossOrigin = "anonymous";
        script.referrerPolicy = "no-referrer";
        script.onload = resolve;
        script.onerror = () => {
          libraries.delete(src);
          script.remove();
          reject(new Error("Chart library failed to load"));
        };
        document.head.append(script);
      }),
    );
  }
  return libraries.get(src);
}

async function renderChart(container) {
  container.id ||= `serenity-chart-${++chartId}`;
  await loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/echarts/5.6.0/echarts.min.js",
    "sha512-XSmbX3mhrD2ix5fXPTRQb2FwK22sRMVQTpBP2ac8hX7Dh/605hA2QDegVWiAvZPiXIxOV0CbkmUjGionDpbCmw==",
  );
  if (container.dataset.chartGl === "true") {
    await loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/echarts-gl/2.0.8/echarts-gl.min.js",
      "sha512-BU2/2iqpnDMN4hyqWPLo5MsqlkOF2xOVC8we4iZVZ7xhGfkk7tSiLnxPJb0xZrbhjmtb7qBQ7w3WdAtF13b1sQ==",
    );
  }
  const definition = await import(container.dataset.chartSrc);
  const option =
    typeof definition.default === "function"
      ? definition.default(window.echarts)
      : definition.default;
  if (!option || typeof option !== "object")
    throw new Error("Chart module must export an option object");
  let chart;
  let renderedDark;
  let dark = document.body.classList.contains("dark");
  const draw = () => {
    // A chart inside closed <details> must wait for a nonzero layout size.
    if (!container.clientWidth || !container.clientHeight) return;
    if (chart) chart.dispose();
    container.replaceChildren();
    chart = window.echarts.init(container, dark ? "dark" : undefined);
    const styled = { ...option, backgroundColor: "transparent" };
    // ECharts GL does not inherit all of the built-in dark theme's axis colors.
    if (container.dataset.chartGl === "true") {
      const css = getComputedStyle(document.body);
      const text = css.getPropertyValue("--text-color").trim();
      const line = css.getPropertyValue("--text-decoration-color").trim();
      const styleAxis = (axis) => ({
        ...axis,
        nameTextStyle: { color: text, ...axis.nameTextStyle },
        axisLabel: { color: text, ...axis.axisLabel },
        axisLine: {
          ...axis.axisLine,
          lineStyle: { color: line, ...axis.axisLine?.lineStyle },
        },
        splitLine: {
          ...axis.splitLine,
          lineStyle: { color: line, ...axis.splitLine?.lineStyle },
        },
      });
      for (const key of ["xAxis3D", "yAxis3D", "zAxis3D"]) {
        if (option[key])
          styled[key] = Array.isArray(option[key])
            ? option[key].map(styleAxis)
            : styleAxis(option[key]);
      }
    }
    chart.setOption(styled);
    renderedDark = dark;
    container.dataset.state = "ready";
    container.dataset.theme = dark ? "dark" : "light";
  };
  draw();
  const resize = new ResizeObserver(() => {
    if (!chart || renderedDark !== dark) draw();
    else chart.resize();
  });
  resize.observe(container);
  const theme = new MutationObserver(() => {
    const nextDark = document.body.classList.contains("dark");
    if (nextDark !== dark) {
      dark = nextDark;
      draw();
    }
  });
  theme.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  // Release WebGL contexts when leaving, but keep bfcache pages live.
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    resize.disconnect();
    theme.disconnect();
    chart?.dispose();
  });
}

// Module scripts run once after parsing, even when several components include them.
document.querySelectorAll(".echart[data-chart-src]").forEach((container) => {
  renderChart(container).catch((error) => {
    window.echarts?.getInstanceByDom(container)?.dispose();
    container.dataset.state = "error";
    container.textContent = "Chart unavailable. Please reload the page.";
    console.error("Unable to render chart:", error);
  });
});
