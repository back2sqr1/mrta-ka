<script lang="ts">
  import {
    SvelteFlow,
    useSvelteFlow,
    Background,
    Panel,
    addEdge,
    type Edge,
    type Node,
    type OnConnect,
    type OnConnectEnd,
    type NodeEventWithPointer,
    type OnBeforeDelete,
    getIncomers,
    getOutgoers,
    getConnectedEdges,
  } from '@xyflow/svelte';
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { uiColorToDb, dbColorToUi, getMexId, getMexEdgeId, saveFlowToSupabase } from '$lib/utils';

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
  let nodeGroupsList: any[] = $state([]);

  let loaded = false;

  onMount(async () => {
    const { data: nodesData } = await supabase.from('nodes').select('*');
    const { data: edgesData } = await supabase.from('edges').select('*');
    const { data: groupMembersData } = await supabase.from('node_group_members').select('*');
    const { data: groupsData } = await supabase.from('node_groups').select('*');

    if (groupsData) {
      nodeGroupsList = groupsData;
    }

    const nodeGroups = new Map();
    if (groupMembersData) {
      groupMembersData.forEach((m: any) => {
        nodeGroups.set(m.node_id, { id: m.id, group_id: m.node_group_id });
      });
    }

    if (nodesData && nodesData.length > 0) {
      nodes = nodesData.map((n: any) => {
        const groupInfo = nodeGroups.get(n.id);
        return {
          id: n.id,
          type: n.id === 'A' ? 'input' : 'default',
          data: {
            label: n.id,
            x_coord: n.decision_x,
            y_coord: n.decision_y,
            color: dbColorToUi(n.color),
            node_group_member_id: groupInfo?.id,
            node_group_id: groupInfo?.group_id,
          },
          position: { x: n.location_x, y: n.location_y },
          style: `background: ${dbColorToUi(n.color)}`,
        };
      });
    } else {
      nodes = initialNodes;
    }

    if (edgesData) {
      edges = edgesData.map((e: any) => ({
        id: String(e.id),
        source: e.source_node_id,
        target: e.target_node_id,
        animated: true,
      }));
    }
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
    let remainingNodes = [...nodes]; 
    
    edges = deletedNodes.reduce((acc, node) => {
      const incomers = getIncomers(node, remainingNodes, acc);
      const outgoers = getOutgoers(node, remainingNodes, acc);
      const connectedEdges = getConnectedEdges([node], acc);

      const remainingEdges = acc.filter((edge) => !connectedEdges.includes(edge));

      const createdEdges = incomers.flatMap(({ id: source }) =>
        outgoers.map(({ id: target }) => {
            const edgeId = getMexEdgeId([...remainingEdges]);
            return {
                id: edgeId,
                source,
                target,
                animated: true,
            };
        }),
      );

      remainingNodes = remainingNodes.filter((rn) => rn.id !== node.id);

      return [...remainingEdges, ...createdEdges];
    }, edges);

    nodes = remainingNodes;

    return true;
  };

  const handleConnect: OnConnect = (params) => {
    // Remove any existing edge that matches the connection to ensure we replace it with the animated one
    const filteredEdges = edges.filter(e => {
        const isSameSource = e.source === params.source;
        const isSameTarget = e.target === params.target;
        const isSameSourceHandle = (e.sourceHandle ?? null) === (params.sourceHandle ?? null);
        const isSameTargetHandle = (e.targetHandle ?? null) === (params.targetHandle ?? null);
        return !(isSameSource && isSameTarget && isSameSourceHandle && isSameTargetHandle);
    });

    const edgeId = getMexEdgeId(filteredEdges);
    console.log('Connecting with edge ID:', edgeId, { source: params.source, target: params.target, id: edgeId, animated: true });
    edges = addEdge({ ...params, id: edgeId, animated: true }, filteredEdges);
  };

  const handleConnectEnd: OnConnectEnd = (event, connectionState) => {
    if (connectionState.isValid) return;
    // console.log("Connect end - adding new node");

    const sourceNodeId = connectionState.fromNode?.id ?? 'A';
    const id = getMexId(nodes);
    const edgeId = getMexEdgeId(edges);
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
        id: edgeId,
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
  let nodeGroupId: number | null = $state(null);
  let isCreatingGroup = $state(false);
  let newGroupName = $state('');

  const handleNodeClick = ({ node }: { node: Node }) => {
    selectedNodeId = node.id;
    nodeLabel = node.data.label as string;
    nodeX = node.data.x_coord as number;
    nodeY = node.data.y_coord as number;
    nodeColor = (node.data.color as string) || '#ffffff';
    nodeGroupId = (node.data.node_group_id as number) || null;
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
        return {
          ...node,
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
    
    const { data, error } = await supabase
        .from('node_groups')
        .insert({ name: newGroupName })
        .select()
        .single();
    
    if (error) {
        console.error('Error creating group:', error);
        return;
    }

    if (data) {
        nodeGroupsList = [...nodeGroupsList, data];
        nodeGroupId = data.id;
        isCreatingGroup = false;
        newGroupName = '';
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
</script>

<div class="h-screen w-screen">
  <SvelteFlow
    bind:nodes
    bind:edges
    fitView
    onconnect={handleConnect}
    onconnectend={handleConnectEnd}
    onnodecontextmenu={handleContextMenu}
    onnodeclick={handleNodeClick}
    onpaneclick={handlePaneClick}
    {onbeforedelete}
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
            <label class="flex flex-col">
                <span class="text-sm font-medium">Group:</span>
                {#if isCreatingGroup}
                    <div class="flex flex-col gap-1">
                        <input 
                            type="text" 
                            placeholder="New Group Name"
                            bind:value={newGroupName}
                            class="border p-1 rounded"
                        />
                        <div class="flex gap-1">
                            <button onclick={createGroup} class="bg-blue-500 text-white px-2 py-1 rounded text-xs">Create</button>
                            <button onclick={cancelCreateGroup} class="bg-gray-300 px-2 py-1 rounded text-xs">Cancel</button>
                        </div>
                    </div>
                {:else}
                    <select value={nodeGroupId || ''} onchange={updateGroup} class="border p-1 rounded">
                        <option value="">None</option>
                        {#each nodeGroupsList as group}
                            <option value={group.id}>{group.name}</option>
                        {/each}
                        <option value="__CREATE_NEW__">+ Create New Group</option>
                    </select>
                {/if}
            </label>
        </div>
      </Panel>
    {/if}
  </SvelteFlow>
</div>
