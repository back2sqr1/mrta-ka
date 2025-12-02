<script lang="ts">
  import {
    SvelteFlow,
    useSvelteFlow,
    Background,
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
      let flowNodes = nodesData.map((n: any) => {
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
            group_x: n.group_x,
            group_y: n.group_y,
          },
          position: { x: n.location_x, y: n.location_y },
          style: `background: ${dbColorToUi(n.color)}`,
        };
      });

      // Process Groups to create Group Nodes
      const groupsMap = new Map<number, { id: number, name: string, position_x?: number, position_y?: number, box_width?: number, box_height?: number, nodes: Node[] }>();
      
      if (groupsData) {
         groupsData.forEach((g: any) => groupsMap.set(g.id, { ...g, nodes: [] }));
      }

      // Assign nodes to their groups in the map
      flowNodes.forEach((n: Node) => {
          const gid = n.data.node_group_id as number;
          if (gid && groupsMap.has(gid)) {
              groupsMap.get(gid)!.nodes.push(n);
          }
      });

      const groupNodes: Node[] = [];
      
      groupsMap.forEach((g) => {
          if (g.nodes.length === 0) return;

          const padding = 40;
          let groupX: number;
          let groupY: number;

          // Determine Group Position
          if (g.position_x != null && g.position_y != null) {
              groupX = g.position_x;
              groupY = g.position_y;
          } else {
              // Fallback: Calculate from children's absolute positions
              const xs = g.nodes.map(n => n.position.x);
              const ys = g.nodes.map(n => n.position.y);
              groupX = Math.min(...xs) - padding;
              groupY = Math.min(...ys) - padding;
          }

          // Determine Dimensions based on children relative to the group position
          // We need to calculate where children *will* be to know the size
          let minRelX = Infinity, maxRelX = -Infinity;
          let minRelY = Infinity, maxRelY = -Infinity;

          g.nodes.forEach(n => {
              let relX, relY;
              if (n.data.group_x != null && n.data.group_y != null) {
                  relX = n.data.group_x as number;
                  relY = n.data.group_y as number;
              } else {
                  relX = n.position.x - groupX;
                  relY = n.position.y - groupY;
              }
              
              // Update node with relative position for Svelte Flow
              n.parentId = `group-${g.id}`;
              n.position.x = relX;
              n.position.y = relY;
              // n.extent = 'parent'; // Removed to allow nodes to go outside
              
              minRelX = Math.min(minRelX, relX);
              maxRelX = Math.max(maxRelX, relX);
              minRelY = Math.min(minRelY, relY);
              maxRelY = Math.max(maxRelY, relY);
          });

          // If for some reason we have no children (checked above), defaults
          if (minRelX === Infinity) { minRelX = 0; maxRelX = 100; minRelY = 0; maxRelY = 100; }

          let width: number;
          let height: number;

          if (g.box_width != null && g.box_height != null) {
              width = g.box_width;
              height = g.box_height;
          } else {
              // Calculate width/height with some padding/margin
              width = maxRelX + 150 + padding; 
              height = maxRelY + 50 + padding;
          }

          const groupNode: Node = {
              id: `group-${g.id}`,
              type: 'group',
              data: { label: g.name },
              position: { x: groupX, y: groupY },
              style: `width: ${width}px; height: ${height}px; background-color: rgba(240, 240, 240, 0.5); border: 2px dashed #ccc; z-index: -1;`,
              width: width,
              height: height,
          };
          groupNodes.push(groupNode);
      });

      nodes = [...groupNodes, ...flowNodes];
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
                style: `width: ${groupWidth}px; height: ${groupHeight}px; background-color: rgba(240, 240, 240, 0.5); border: 2px dashed #ccc; z-index: -1;`
             };
        } else {
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
