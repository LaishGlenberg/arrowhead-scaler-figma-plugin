figma.showUI(__html__, { width: 220, height: 110 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'apply-scaling') {
    const factor = msg.factor;
    const selection = figma.currentPage.selection;

    for (const node of selection) {
      if (node.type === "LINE" || node.type === "VECTOR") {
        await applyProportionalArrow(node, factor);
      }
    }
  }
};

async function applyProportionalArrow(node: LineNode | VectorNode, factor: number) {
  // LineNode is a subset of VectorNode. We cast to access vectorNetwork.
  const vectorNode = node as VectorNode;
  const network = vectorNode.vectorNetwork;
  
  if (network.vertices.length < 2) return;

  // 1. Get the direction from the last segment
  const lastSegment = network.segments[network.segments.length - 1];
  const start = network.vertices[lastSegment.start];
  const end = network.vertices[lastSegment.end];

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length === 0) return;

  const ux = dx / length;
  const uy = dy / length;

  // 2. Calculate arrowhead points
  const weight = typeof node.strokeWeight === 'number' ? node.strokeWeight : 1;
  const arrowSize = weight * factor;
  const arrowWidth = arrowSize * 0.5; // Controls the "pointiness"

  const wing1 = {
    x: end.x - ux * arrowSize + uy * arrowWidth,
    y: end.y - uy * arrowSize - ux * arrowWidth
  };

  const wing2 = {
    x: end.x - ux * arrowSize - uy * arrowWidth,
    y: end.y - uy * arrowSize + ux * arrowWidth
  };

  // 3. Construct the new Network
  // We keep existing vertices/segments and add the 2 wing points
  const newVertices = [...network.vertices, wing1, wing2];
  const endIdx = lastSegment.end;
  const w1Idx = newVertices.length - 2;
  const w2Idx = newVertices.length - 1;

  // IMPORTANT: We must add segments (edges) connected to the 'end' vertex
  const newSegments = [
    ...network.segments,
    { start: endIdx, end: w1Idx }, // Edge from line-end to wing1
    { start: endIdx, end: w2Idx }  // Edge from line-end to wing2
  ];

  // 4. Apply changes
  // Remove native arrowhead first
  node.strokeCap = "NONE"; 

  // Since manifest.json has "documentAccess": "dynamic-page", 
  // you MUST use the Async setter.
  try {
    await vectorNode.setVectorNetworkAsync({
      vertices: newVertices,
      segments: newSegments,
      regions: network.regions // Keep existing fills if any
    });
  } catch (err) {
    console.error("Failed to update vector network:", err);
  }
}