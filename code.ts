figma.showUI(__html__, { width: 220, height: 160 });

figma.ui.onmessage = async (msg) => {
  const selection = figma.currentPage.selection;

  if (msg.type === 'apply-scaling') {
    for (const node of selection) {
      if (node.type === "LINE" || node.type === "VECTOR") {
        await applyProportionalArrows(node, msg.factor, msg.startCap, msg.endCap);
      }
    }
  }

  if (msg.type === 'revert') {
    for (const node of selection) {
      if (node.type === "LINE" || node.type === "VECTOR") {
        await revertToOriginal(node);
      }
    }
  }
};

async function applyProportionalArrows(node: LineNode | VectorNode, factor: number, startCap: string, endCap: string) {
  const vectorNode = node as VectorNode;
  
  // 1. Check if we have a backup. If not, save current as original.
  let originalNetworkJson = node.getPluginData("original-network");
  let network: VectorNetwork;

  if (!originalNetworkJson) {
    // First time applying: save the state BEFORE we add custom points
    network = vectorNode.vectorNetwork;
    node.setPluginData("original-network", JSON.stringify(network));
  } else {
    // Already modified: start from the clean original network to avoid "arrow-on-arrow"
    network = JSON.parse(originalNetworkJson);
  }

  if (network.vertices.length < 2) return;

  const weight = typeof node.strokeWeight === 'number' ? node.strokeWeight : 1;
  const arrowSize = weight * factor;
  const arrowWidth = arrowSize * 0.5;

  const newVertices = [...network.vertices];
  const newSegments = [...network.segments];

  // Helper to add wings
  const addArrow = (pointIdx: number, fromIdx: number) => {
    const p = newVertices[pointIdx];
    const f = newVertices[fromIdx];
    const dx = p.x - f.x;
    const dy = p.y - f.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const ux = dx / len;
    const uy = dy / len;

    const w1 = { x: p.x - ux * arrowSize + uy * arrowWidth, y: p.y - uy * arrowSize - ux * arrowWidth };
    const w2 = { x: p.x - ux * arrowSize - uy * arrowWidth, y: p.y - uy * arrowSize + ux * arrowWidth };

    const w1Idx = newVertices.length;
    const w2Idx = newVertices.length + 1;
    newVertices.push(w1, w2);
    newSegments.push({ start: pointIdx, end: w1Idx }, { start: pointIdx, end: w2Idx });
  };

  // Add arrows based on UI selection
  if (endCap === 'ARROW_EQUILATERAL') {
    const lastSeg = network.segments[network.segments.length - 1];
    addArrow(lastSeg.end, lastSeg.start);
  }
  if (startCap === 'ARROW_EQUILATERAL') {
    const firstSeg = network.segments[0];
    addArrow(firstSeg.start, firstSeg.end);
  }

  // Disable native caps and apply
  node.strokeCap = "NONE";
  await vectorNode.setVectorNetworkAsync({
    vertices: newVertices,
    segments: newSegments,
    regions: network.regions
  });
}

async function revertToOriginal(node: LineNode | VectorNode) {
  const data = node.getPluginData("original-network");
  if (data) {
    const originalNetwork = JSON.parse(data);
    await (node as VectorNode).setVectorNetworkAsync(originalNetwork);
    node.setPluginData("original-network", ""); // Clear the backup
  }
}