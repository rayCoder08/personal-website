import {
  indexGraph, connectedNodeIds, graphEdgePaths,
  constrainGraphCamera, overviewGraphCamera, GRAPH_ZOOM_LIMITS,
} from "./graph-model.js";

const platform = "https://aerochronix.netlify.app/";
const ns = "http://www.w3.org/2000/svg";

function svgElement(name, attributes = {}, content = "") {
  const element = document.createElementNS(ns, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (content) element.textContent = content;
  return element;
}

function labelLines(text, maxLength) {
  const words = text.split(" ");
  const lines = [words.shift() ?? ""];
  for (const word of words) {
    const last = lines.length - 1;
    if (lines[last].length + word.length + 1 > maxLength) lines.push(word);
    else lines[last] += " " + word;
  }
  return lines;
}

// The original GraphNodeView uses circular case thumbnails, coloured factor squares,
// stable positions, native title tooltips, and keyboard-operable SVG groups.
function createNode(node, position, choose, bringIntoView, compact) {
  const group = svgElement("g", {
    class: "graph-node graph-node--" + node.kind,
    transform: "translate(" + position.x + " " + position.y + ")",
    tabindex: "0",
    role: "button",
    "aria-label": (node.kind === "incident" ? "Incident: " : "Factor: ") + node.title,
    "aria-pressed": "false",
  });
  group.append(svgElement("title", {}, node.title));
  group.append(svgElement("circle", { r: 37, class: "graph-node-hit" }));

  if (node.kind === "incident") {
    const clipId = "hero-" + node.id.replaceAll(":", "-");
    const clip = svgElement("clipPath", { id: clipId });
    clip.append(svgElement("circle", { r: 26 }));
    group.append(clip, svgElement("circle", { r: 29, class: "graph-incident-ring" }));
    group.append(svgElement("image", {
      href: node.thumbnail, x: -26, y: -26, width: 52, height: 52,
      preserveAspectRatio: "xMidYMid slice", "clip-path": "url(#" + clipId + ")",
    }));
  } else {
    group.dataset.category = node.category;
    group.append(
      svgElement("rect", { x: -16, y: -16, width: 32, height: 32, rx: 4, class: "graph-factor-shape" }),
      svgElement("circle", { r: 2.8, class: "graph-factor-center" }),
    );
  }

  const label = svgElement("text", { class: "graph-node-label", "text-anchor": "middle" });
  const firstLine = node.kind === "incident" ? 47 : 39;
  labelLines(node.label, compact && node.kind === "incident" ? 12 : 17).forEach((line, index) => {
    label.append(svgElement("tspan", { x: 0, y: firstLine + index * 19 }, line));
  });
  group.append(label);
  group.addEventListener("click", () => choose(node.id));
  group.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    choose(node.id);
  });
  group.addEventListener("focus", () => bringIntoView(node.id));
  return group;
}

function mountGraph(container, { nodes, edges, layouts }) {
  const svg = container.querySelector(".graph-svg");
  const picker = container.querySelector(".graph-picker select");
  const title = container.querySelector(".graph-detail-title");
  const description = container.querySelector(".graph-detail-description");
  const detailLinks = container.querySelector(".graph-detail-links");
  const caseLink = container.querySelector(".graph-case-link");
  const photoLink = container.querySelector(".graph-photo-link");
  const controls = [...container.querySelectorAll("[data-graph-action]")];
  const compact = window.matchMedia("(max-width: 760px)");
  const { nodeById, neighbors, edgesByNode } = indexGraph(nodes, edges);

  let extent, camera, world, points, pointById, nodeViews, edgeViews, drag;
  let selected = "";
  let suppressClickUntil = 0;

  for (const kind of ["incident", "factor"]) {
    const group = document.createElement("optgroup");
    group.label = kind === "incident" ? "Incidents" : "Contributing factors";
    for (const node of nodes.filter((record) => record.kind === kind)) {
      const option = document.createElement("option");
      option.value = node.id;
      option.textContent = node.title;
      group.append(option);
    }
    picker.append(group);
  }

  function setCamera(next, anchor) {
    camera = constrainGraphCamera(next, extent, points, anchor);
    world.setAttribute("transform", "translate(" + camera.x + " " + camera.y + ") scale(" + camera.k + ")");
    controls[0].disabled = camera.k <= GRAPH_ZOOM_LIMITS[0] + 0.001;
    controls[1].disabled = camera.k >= GRAPH_ZOOM_LIMITS[1] - 0.001;
  }

  function bringIntoView(id) {
    const anchor = pointById.get(id);
    if (anchor) setCamera(camera, anchor);
  }

  function highlight() {
    const connection = selected ? neighbors.get(selected) : undefined;
    const context = selected ? connectedNodeIds(selected, neighbors) : undefined;
    for (const [id, node] of nodeViews) {
      node.classList.toggle("is-selected", id === selected);
      node.classList.toggle("is-related", Boolean(connection?.has(id)));
      node.classList.toggle("is-context", Boolean(context?.has(id)));
      node.classList.toggle("is-dimmed", Boolean(selected && !context?.has(id)));
      node.setAttribute("aria-pressed", String(id === selected));
    }
    for (const [edge, path] of edgeViews) {
      const active = edge.source === selected || edge.target === selected;
      path.classList.toggle("is-active", active);
      path.classList.toggle("is-muted", Boolean(selected && !active));
    }
  }

  function choose(id) {
    if (performance.now() < suppressClickUntil) return;
    selected = id;
    const node = nodeById.get(id);
    picker.value = id;
    title.textContent = node?.title ?? "Runway safety and visibility";
    const count = edgesByNode.get(id)?.length ?? 0;
    description.textContent = node?.kind === "factor"
      ? node.description + " Links " + count + (count === 1 ? " case" : " cases") + " in this view."
      : node?.description ?? "Select an incident or contributing factor to see its documented connections.";

    const isIncident = node?.kind === "incident";
    detailLinks.hidden = !isIncident;
    if (isIncident) {
      caseLink.href = platform + "#/incidents/" + node.id.slice("incident:".length);
      photoLink.hidden = !node.photoSource;
      if (node.photoSource) {
        photoLink.href = node.photoSource;
        photoLink.textContent = "Photo: " + node.creator + " · " + node.license;
      }
    }
    highlight();
    if (id) bringIntoView(id);
  }

  function render() {
    const layout = layouts[compact.matches ? "narrow" : "wide"];
    const { width, height, positions } = layout;
    extent = [[0, 0], [width, height]];
    points = nodes.map((node) => {
      const [x, y] = positions[node.id];
      return { ...node, x, y };
    });
    pointById = new Map(points.map((point) => [point.id, point]));
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    world = svgElement("g", { class: "graph-world" });
    edgeViews = graphEdgePaths(points, edges).map(({ edge, path }) => [
      edge, svgElement("path", { class: "graph-edge", d: path, "aria-hidden": "true" }),
    ]);
    nodeViews = new Map(points.map((node) => [
      node.id, createNode(node, node, choose, bringIntoView, compact.matches),
    ]));
    world.append(...edgeViews.map(([, path]) => path), ...nodeViews.values());
    svg.replaceChildren(world);
    setCamera(overviewGraphCamera(extent, points));
    highlight();
    if (selected) bringIntoView(selected);
  }

  function reset() {
    choose("");
    setCamera(overviewGraphCamera(extent, points));
  }

  function zoomBy(factor, point = { x: extent[1][0] / 2, y: extent[1][1] / 2 }) {
    const zoom = Math.min(GRAPH_ZOOM_LIMITS[1], Math.max(GRAPH_ZOOM_LIMITS[0], camera.k * factor));
    const ratio = zoom / camera.k;
    setCamera({
      k: zoom,
      x: point.x - (point.x - camera.x) * ratio,
      y: point.y - (point.y - camera.y) * ratio,
    });
  }

  function positionOnSvg(event) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }

  svg.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, from: positionOnSvg(event), camera, moved: false };
  });
  svg.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (event.pointerType === "mouse" && !(event.buttons & 1)) {
      endDrag();
      return;
    }
    const pointer = positionOnSvg(event);
    const x = pointer.x - drag.from.x;
    const y = pointer.y - drag.from.y;
    if (!drag.moved && Math.hypot(x, y) < 7) return;
    if (!drag.moved) {
      drag.moved = true;
      svg.setPointerCapture(event.pointerId);
      svg.classList.add("is-dragging");
    }
    setCamera({ ...drag.camera, x: drag.camera.x + x, y: drag.camera.y + y });
  });
  const endDrag = () => {
    if (drag?.moved) suppressClickUntil = performance.now() + 100;
    drag = undefined;
    svg.classList.remove("is-dragging");
  };
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
  svg.addEventListener("lostpointercapture", endDrag);
  svg.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12, positionOnSvg(event));
  }, { passive: false });

  container.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && event.target !== picker) {
      reset();
      return;
    }
    if (event.target !== svg) return;
    if (event.key === "+" || event.key === "=" || event.key === "-") {
      event.preventDefault();
      zoomBy(event.key === "-" ? 1 / 1.3 : 1.3);
      return;
    }
    const pan = { ArrowLeft: [45, 0], ArrowRight: [-45, 0], ArrowUp: [0, 45], ArrowDown: [0, -45] }[event.key];
    if (!pan) return;
    event.preventDefault();
    setCamera({ ...camera, x: camera.x + pan[0], y: camera.y + pan[1] });
  });

  controls[0].addEventListener("click", () => zoomBy(1 / 1.3));
  controls[1].addEventListener("click", () => zoomBy(1.3));
  controls[2].addEventListener("click", reset);
  picker.addEventListener("change", () => picker.value ? choose(picker.value) : reset());
  compact.addEventListener("change", render);

  render();
  svg.removeAttribute("hidden");
  container.querySelector(".graph-fallback").hidden = true;
  picker.disabled = false;
  controls[2].disabled = false;
}

const graph = document.querySelector(".hero-graph");
if (graph) {
  fetch(new URL("./assets/graph/catalog.json", import.meta.url))
    .then((response) => {
      if (!response.ok) throw new Error("The incident catalog could not be loaded.");
      return response.json();
    })
    .then((catalog) => mountGraph(graph, catalog))
    .catch(() => {
      graph.querySelector(".graph-detail-description").textContent =
        "Explore the live Aerochronix platform for the interactive graph.";
    });
}
