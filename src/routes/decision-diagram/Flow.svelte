<script lang="ts">
  import {
    SvelteFlow,
    useSvelteFlow,
    Background,
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
      data: { label: 'A' , x_coord: 0, y_coord: 0},
      position: { x: 0, y: 50 },
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
      data: { label: `${id}`, x_coord: 0, y_coord: 0 },
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
      },
    ];
  };

  const handleContextMenu = ({ event, node }: { event: MouseEvent; node: Node }) => {
    event.preventDefault();
    if (node.id === 'A') return;
    deleteElements({ nodes: [{ id: node.id }] });
  };
</script>

<div class="h-screen w-screen">
  <SvelteFlow
    bind:nodes
    bind:edges
    fitView
    onconnectend={handleConnectEnd}
    onnodecontextmenu={handleContextMenu}
  >
    <Background />
  </SvelteFlow>
</div>
