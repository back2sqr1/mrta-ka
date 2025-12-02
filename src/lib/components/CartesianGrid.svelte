<script lang="ts">
  import {
    SvelteFlow,
    useSvelteFlow,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    type Node,
    type Edge,
    type NodeTypes,
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import PointNode from './PointNode.svelte';

  let { nodes = $bindable([]), edges = $bindable([]) } = $props<{
    nodes: Node[];
    edges: Edge[];
  }>();

  const nodeTypes: NodeTypes = {
    point: PointNode,
  };

  const defaultEdgeOptions = {
    type: 'smoothstep',
    animated: true,
  };

  function onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();

    if (!event.dataTransfer) {
      return;
    }

    const type = event.dataTransfer.getData('application/svelteflow');
    
    // If we are dragging from outside (e.g. a sidebar), we can handle it here.
    // For now, we'll assume this component handles internal interactions.
  }
</script>

<div class="h-full w-full bg-gray-50">
  <SvelteFlow
    bind:nodes
    bind:edges
    {nodeTypes}
    {defaultEdgeOptions}
    nodesConnectable={false}
    nodesDraggable={false}
    fitView
    minZoom={0.1}
    maxZoom={4}
    class="bg-gray-50"
  >
    <Background variant={BackgroundVariant.Lines} gap={20} size={1} color="#e5e7eb" />
    <Controls />
    <MiniMap />
    
    <!-- Optional: Custom Grid Overlay or Axes could go here inside a Panel -->
  </SvelteFlow>
</div>
