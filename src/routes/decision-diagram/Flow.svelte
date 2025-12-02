<script lang="ts">
  import {
    SvelteFlow,
    useSvelteFlow,
    Background,
    type Edge,
    type Node,
    type OnConnect,
    type OnConnectEnd,
  } from '@xyflow/svelte';
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { saveFlowToSupabase, hexToRgba } from '$lib/utils';
  import { loadFlowData, handleNodeDelete, createNewNodeOnConnectEnd, handleConnection, createGroupInDb, createGroupNode } from './flowHelpers.js';
  import GroupNode from './GroupNode.svelte';
  import EditPanel from './EditPanel.svelte';

  import '@xyflow/svelte/dist/style.css';

  const nodeTypes = {
    group: GroupNode,
  };

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
  let nodeGroupsList: any[] = $state([]);

  let loaded = false;

  onMount(async () => {
    const data = await loadFlowData(supabase);
    if (data.nodes.length > 0) {
        nodes = data.nodes;
    } else {
        nodes = initialNodes;
    }
    edges = data.edges;
    nodeGroupsList = data.nodeGroupsList;
    loaded = true;
  });

  async function saveFlow() {
    if (!loaded) return;
    await saveFlowToSupabase(supabase, nodes, edges);
  }

  let saveTimeout: ReturnType<typeof setTimeout>;

  $effect(() => {
    // dependencies
    const n = nodes;
    const e = edges;

    if (!loaded) return;

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveFlow();
    }, 1000);
  });


  const { screenToFlowPosition, deleteElements } = useSvelteFlow();

  const onbeforedelete: any = async ({ nodes: deletedNodes, edges: _edges }: { nodes: Node[], edges: Edge[] }) => {
    const result = handleNodeDelete(deletedNodes, nodes, edges);
    nodes = result.nodes;
    edges = result.edges;
    return true;
  };

  const handleConnect: OnConnect = (params) => {
    edges = handleConnection(params, edges);
  };

  const handleConnectEnd: OnConnectEnd = (event, connectionState) => {
    const result = createNewNodeOnConnectEnd(event, connectionState, nodes, edges, screenToFlowPosition);
    if (result) {
        nodes = [...nodes, result.newNode];
        edges = [...edges, result.newEdge];
    }
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
  let nodeGroupId: number | null = $state(null);
  let isCreatingGroup = $state(false);
  let newGroupName = $state('');
  let isGroupNode = $state(false);
  let groupWidth = $state(0);
  let groupHeight = $state(0);

  const handleNodeClick = ({ node }: { node: Node }) => {
    selectedNodeId = node.id;
    nodeLabel = node.data.label as string;
    
    if (node.type === 'group') {
        isGroupNode = true;
        nodeX = node.position.x;
        nodeY = node.position.y;
        groupWidth = node.width ?? parseFloat(/width:\s*([\d.]+)px/.exec(node.style || '')?.[1] || '0');
        groupHeight = node.height ?? parseFloat(/height:\s*([\d.]+)px/.exec(node.style || '')?.[1] || '0');
    } else {
        isGroupNode = false;
        nodeX = node.data.x_coord as number;
        nodeY = node.data.y_coord as number;
        nodeColor = (node.data.color as string) || '#ffffff';
        nodeGroupId = (node.data.node_group_id as number) || null;
    }

    isCreatingGroup = false;
    newGroupName = '';
  };

  const handlePaneClick = () => {
    selectedNodeId = null;
    isCreatingGroup = false;
  };

  function updateNode() {
    if (!selectedNodeId) return;
    nodes = nodes.map((node) => {
      if (node.id === selectedNodeId) {
        if (node.type === 'group') {
             const groupColor = node.data.color as string;
             return {
                ...node,
                data: {
                    ...node.data,
                    label: nodeLabel
                },
                position: {
                    x: nodeX,
                    y: nodeY
                },
                width: groupWidth,
                height: groupHeight,
                style: `width: ${groupWidth}px; height: ${groupHeight}px; background-color: ${hexToRgba(groupColor, 0.2)}; border: 2px dashed ${groupColor}; z-index: -1;`
             };
        } else {
            // Handle Group Change Logic
            const oldGroupId = node.data.node_group_id;
            const newGroupId = nodeGroupId;
            
            let newParentId = node.parentId;
            let newPosition = { ...node.position };
            
            if (oldGroupId !== newGroupId) {
                // 1. Calculate Absolute Position
                let absX = node.position.x;
                let absY = node.position.y;
                
                if (node.parentId) {
                    const parent = nodes.find(n => n.id === node.parentId);
                    if (parent) {
                        absX += parent.position.x;
                        absY += parent.position.y;
                    }
                }

                // 2. Determine new Parent and Relative Position
                if (newGroupId) {
                    const groupNodeId = `group-${newGroupId}`;
                    const groupNode = nodes.find(n => n.id === groupNodeId);
                    
                    if (groupNode) {
                        newParentId = groupNodeId;
                        newPosition.x = absX - groupNode.position.x;
                        newPosition.y = absY - groupNode.position.y;
                    } else {
                        // If group node doesn't exist on canvas yet, we can't parent it visually
                        // It will be fixed on reload, or we should ensure group nodes exist
                        console.warn(`Group node ${groupNodeId} not found on canvas.`);
                        newParentId = undefined;
                        newPosition.x = absX;
                        newPosition.y = absY;
                    }
                } else {
                    // Removing from group
                    newParentId = undefined;
                    newPosition.x = absX;
                    newPosition.y = absY;
                }
            }

            return {
            ...node,
            parentId: newParentId,
            position: newPosition,
            data: {
                ...node.data,
                label: nodeLabel,
                x_coord: nodeX,
                y_coord: nodeY,
                color: nodeColor,
                node_group_id: nodeGroupId,
            },
            style: `background: ${nodeColor}`,
            };
        }
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

  function updateGroup(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    if (val === '__CREATE_NEW__') {
        isCreatingGroup = true;
        return;
    }
    nodeGroupId = val ? parseInt(val) : null;
    updateNode();
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;
    
    const data = await createGroupInDb(supabase, newGroupName, nodeColor);
    
    if (data) {
        nodeGroupsList = [...nodeGroupsList, data];
        nodeGroupId = data.id;
        isCreatingGroup = false;
        newGroupName = '';

        const newGroupNode = createGroupNode(data, selectedNodeId, nodes);
        nodes = [...nodes, newGroupNode];

        updateNode();
    }
  }

  function cancelCreateGroup() {
    isCreatingGroup = false;
    newGroupName = '';
    // Reset selection to current node's group if any
    const node = nodes.find(n => n.id === selectedNodeId);
    if (node) {
        nodeGroupId = (node.data.node_group_id as number) || null;
    }
  }

  const handleNodeDragStop = () => {
    saveFlow();
  };

  const handleNodeResizeEnd = () => {
    saveFlow();
  };
</script>

<div class="h-screen w-screen">
  <SvelteFlow
    bind:nodes
    bind:edges
    fitView
    {nodeTypes}
    onconnect={handleConnect}
    onconnectend={handleConnectEnd}
    onnodecontextmenu={handleContextMenu}
    onnodeclick={handleNodeClick}
    onpaneclick={handlePaneClick}
    onnodedragstop={handleNodeDragStop}
    onnoderesizeend={handleNodeResizeEnd}
    {onbeforedelete}
  >
    <Background />
    <EditPanel
        {selectedNodeId}
        {isGroupNode}
        {nodeLabel}
        {nodeX}
        {nodeY}
        {nodeColor}
        {nodeGroupId}
        {isCreatingGroup}
        bind:newGroupName
        {nodeGroupsList}
        {updateLabel}
        {updateX}
        {updateY}
        {updateColor}
        {updateGroup}
        {createGroup}
        {cancelCreateGroup}
    />
  </SvelteFlow>
</div>
