<script lang="ts">
  import {
    SvelteFlow,
    useSvelteFlow,
    Background,
    Panel,
    type Edge,
    type Node,
    type OnConnectEnd,
    type NodeEventWithPointer,
  } from '@xyflow/svelte';

  import '@xyflow/svelte/dist/style.css';

  const initialNodes: Node[] = [
    {
      id: 'A',
      type: 'input',
      data: { label: 'A' , x_coord: 0, y_coord: 0, color: '#bbf7d0'},
      position: { x: 0, y: 50 },
      style: 'background: #bbf7d0',
    },
  ];

  let nodes = $state.raw<Node[]>(initialNodes);
  let edges = $state.raw<Edge[]>([]);

  const getMexId = (currentNodes: Node[]) => {
    const existingIds = new Set(currentNodes.map((n) => n.id));
    let i = 0;
    while (true) {
      const letter = String.fromCharCode(65 + (i % 26));
      const prefix =
        Math.floor(i / 26) > 0
          ? String.fromCharCode(64 + Math.floor(i / 26))
          : '';
      const candidateId = prefix + letter;
      if (!existingIds.has(candidateId)) {
        return candidateId;
      }
      i++;
    }
  };

  const { screenToFlowPosition, deleteElements } = useSvelteFlow();

  const handleConnectEnd: OnConnectEnd = (event, connectionState) => {
    if (connectionState.isValid) return;

    const sourceNodeId = connectionState.fromNode?.id ?? 'A';
    const id = getMexId(nodes);
    const { clientX, clientY } =
      'changedTouches' in event ? event.changedTouches[0] : event;

    const newNode: Node = {
      id,
      data: { label: `${id}`, x_coord: 0, y_coord: 0, color: '#bbf7d0' },
      style: 'background: #bbf7d0',
      // project the screen coordinates to pane coordinates
      position: screenToFlowPosition({
        x: clientX,
        y: clientY,
      }),
      // set the origin of the new node so it is centered
      origin: [0.5, 0.0],
    };
    nodes = [...nodes, newNode];
    edges = [
      ...edges,
      {
        source: sourceNodeId,
        target: id,
        id: `${sourceNodeId}--${id}`,
        animated: true,
      },
    ];
  };

  const handleContextMenu = ({ event, node }: { event: MouseEvent; node: Node }) => {
    event.preventDefault();
    if (node.id === 'A') return;
    deleteElements({ nodes: [{ id: node.id }] });
  };

  let selectedNodeId: string | null = $state(null);
  let nodeLabel = $state('');
  let nodeX = $state(0);
  let nodeY = $state(0);
  let nodeColor = $state('#ffffff');

  const handleNodeClick = ({ node }: { node: Node }) => {
    selectedNodeId = node.id;
    nodeLabel = node.data.label as string;
    nodeX = node.data.x_coord as number;
    nodeY = node.data.y_coord as number;
    nodeColor = (node.data.color as string) || '#ffffff';
  };

  const handlePaneClick = () => {
    selectedNodeId = null;
  };

  function updateNode() {
    if (!selectedNodeId) return;
    nodes = nodes.map((node) => {
      if (node.id === selectedNodeId) {
        return {
          ...node,
          data: {
            ...node.data,
            label: nodeLabel,
            x_coord: nodeX,
            y_coord: nodeY,
            color: nodeColor,
          },
          style: `background: ${nodeColor}`,
        };
      }
      return node;
    });
  }

  function updateLabel(event: Event) {
    nodeLabel = (event.target as HTMLInputElement).value;
    updateNode();
  }

  function updateX(event: Event) {
    nodeX = parseFloat((event.target as HTMLInputElement).value);
    updateNode();
  }

  function updateY(event: Event) {
    nodeY = parseFloat((event.target as HTMLInputElement).value);
    updateNode();
  }

  function updateColor(event: Event) {
    nodeColor = (event.target as HTMLSelectElement).value;
    updateNode();
  }
</script>

<div class="h-screen w-screen">
  <SvelteFlow
    bind:nodes
    bind:edges
    fitView
    onconnectend={handleConnectEnd}
    onnodecontextmenu={handleContextMenu}
    onnodeclick={handleNodeClick}
    onpaneclick={handlePaneClick}
  >
    <Background />
    {#if selectedNodeId}
      <Panel position="top-right" class="bg-white p-4 rounded shadow-lg border border-gray-200">
        <div class="flex flex-col gap-2">
            <h3 class="font-bold">Edit Node {selectedNodeId}</h3>
            <label class="flex flex-col">
                <span class="text-sm font-medium">Label:</span>
                <input type="text" value={nodeLabel} oninput={updateLabel} class="border p-1 rounded" />
            </label>
            <label class="flex flex-col">
                <span class="text-sm font-medium">X Coord:</span>
                <input type="number" value={nodeX} oninput={updateX} class="border p-1 rounded" />
            </label>
            <label class="flex flex-col">
                <span class="text-sm font-medium">Y Coord:</span>
                <input type="number" value={nodeY} oninput={updateY} class="border p-1 rounded" />
            </label>
            <label class="flex flex-col">
                <span class="text-sm font-medium">Color:</span>
                <select value={nodeColor} onchange={updateColor} class="border p-1 rounded">
                    <option value="#bbf7d0">Green</option>
                    <option value="#fecaca">Red</option>
                </select>
            </label>
        </div>
      </Panel>
    {/if}
  </SvelteFlow>
</div>
