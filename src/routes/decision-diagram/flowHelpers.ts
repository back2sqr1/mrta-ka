import type { Node, Edge, ConnectionState, Connection } from '@xyflow/svelte';
import { getIncomers, getOutgoers, getConnectedEdges, addEdge } from '@xyflow/svelte';
import { dbColorToUi, uiColorToDb, getMexId, getMexEdgeId, hexToRgba } from '$lib/utils';
import type { SupabaseClient } from '@supabase/supabase-js';

export function handleConnection(params: Connection, edges: Edge[]) {
    const filteredEdges = edges.filter(e => {
        const isSameSource = e.source === params.source;
        const isSameTarget = e.target === params.target;
        const isSameSourceHandle = (e.sourceHandle ?? null) === (params.sourceHandle ?? null);
        const isSameTargetHandle = (e.targetHandle ?? null) === (params.targetHandle ?? null);
        return !(isSameSource && isSameTarget && isSameSourceHandle && isSameTargetHandle);
    });

    const edgeId = getMexEdgeId(filteredEdges);
    return addEdge({ ...params, id: edgeId, animated: true }, filteredEdges);
}

export async function loadFlowData(supabase: SupabaseClient) {
    const { data: nodesData } = await supabase.from('nodes').select('*');
    const { data: edgesData } = await supabase.from('edges').select('*');
    const { data: groupMembersData } = await supabase.from('node_group_members').select('*');
    const { data: groupsData } = await supabase.from('node_groups').select('*');

    let nodeGroupsList: any[] = [];
    if (groupsData) {
      nodeGroupsList = groupsData;
    }

    const nodeGroups = new Map();
    if (groupMembersData) {
      groupMembersData.forEach((m: any) => {
        nodeGroups.set(m.node_id, { id: m.id, group_id: m.node_group_id });
      });
    }

    let nodes: Node[] = [];
    let edges: Edge[] = [];

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
            location_x: n.location_x,
            location_y: n.location_y,
            color: dbColorToUi(n.color),
            node_group_member_id: groupInfo?.id,
            node_group_id: groupInfo?.group_id,
            group_x: n.group_x,
            group_y: n.group_y,
          },
          position: { x: n.decision_x ?? n.location_x ?? 0, y: n.decision_y ?? n.location_y ?? 0 },
          style: `background: ${dbColorToUi(n.color)}`,
        };
      });

      // Process Groups to create Group Nodes
      const groupsMap = new Map<number, { id: number, name: string, color: string, position_x?: number, position_y?: number, box_width?: number, box_height?: number, nodes: Node[] }>();
      
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
              
              if (xs.length > 0) {
                  groupX = Math.min(...xs) - padding;
                  groupY = Math.min(...ys) - padding;
              } else {
                  groupX = 0;
                  groupY = 0;
              }
          }

          // Determine Dimensions based on children relative to the group position
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
              
              n.parentId = `group-${g.id}`;
              n.position.x = relX;
              n.position.y = relY;
              
              minRelX = Math.min(minRelX, relX);
              maxRelX = Math.max(maxRelX, relX);
              minRelY = Math.min(minRelY, relY);
              maxRelY = Math.max(maxRelY, relY);
          });

          if (minRelX === Infinity) { minRelX = 0; maxRelX = 100; minRelY = 0; maxRelY = 100; }

          let width: number;
          let height: number;

          if (g.box_width != null && g.box_height != null) {
              width = g.box_width;
              height = g.box_height;
          } else {
              width = maxRelX + 150 + padding; 
              height = maxRelY + 50 + padding;
          }

          const groupColor = dbColorToUi(g.color);
          const groupNode: Node = {
              id: `group-${g.id}`,
              type: 'group',
              data: { label: g.name, color: groupColor },
              position: { x: groupX, y: groupY },
              style: `width: ${width}px; height: ${height}px; background-color: ${hexToRgba(groupColor, 0.2)}; border: 2px dashed ${groupColor}; z-index: -1;`,
              width: width,
              height: height,
          };
          groupNodes.push(groupNode);
      });

      nodes = [...groupNodes, ...flowNodes];
    }

    if (edgesData) {
      edges = edgesData.map((e: any) => ({
        id: String(e.id),
        source: e.source_node_id,
        target: e.target_node_id,
        animated: true,
      }));
    }

    return { nodes, edges, nodeGroupsList };
}

export function handleNodeDelete(deletedNodes: Node[], nodes: Node[], edges: Edge[]) {
    let remainingNodes = [...nodes]; 
    
    const newEdges = deletedNodes.reduce((acc, node) => {
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

    return { nodes: remainingNodes, edges: newEdges };
}

export function createNewNodeOnConnectEnd(
    event: MouseEvent | TouchEvent,
    connectionState: ConnectionState,
    nodes: Node[],
    edges: Edge[],
    screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number }
) {
    if (connectionState.isValid) return null;

    const sourceNodeId = connectionState.fromNode?.id ?? 'A';
    const id = getMexId(nodes);
    const edgeId = getMexEdgeId(edges);
    const { clientX, clientY } =
      'changedTouches' in event ? (event as TouchEvent).changedTouches[0] : (event as MouseEvent);

    const newNode: Node = {
      id,
      data: { label: `${id}`, x_coord: 0, y_coord: 0, color: '#bbf7d0' },
      style: 'background: #bbf7d0',
      position: screenToFlowPosition({
        x: clientX,
        y: clientY,
      }),
      origin: [0.5, 0.0],
    };

    const newEdge = {
        source: sourceNodeId,
        target: id,
        id: edgeId,
        animated: true,
    };

    return { newNode, newEdge };
}

export async function createGroupInDb(supabase: SupabaseClient, name: string, color: string) {
    const { data, error } = await supabase
        .from('node_groups')
        .insert({ name, color: uiColorToDb(color) })
        .select()
        .single();
    
    if (error) {
        console.error('Error creating group:', error);
        return null;
    }
    return data;
}

export function createGroupNode(groupData: any, selectedNodeId: string | null, nodes: Node[]) {
    const currentNode = nodes.find(n => n.id === selectedNodeId);
    let groupX = 0;
    let groupY = 0;
    
    if (currentNode) {
            // Calculate absolute pos of current node to center group around it
            let absX = currentNode.position.x;
            let absY = currentNode.position.y;
            if (currentNode.parentId) {
                const p = nodes.find(n => n.id === currentNode.parentId);
                if (p) { absX += p.position.x; absY += p.position.y; }
            }
            groupX = absX - 40; // padding
            groupY = absY - 40;
    }

    const groupColor = dbColorToUi(groupData.color);
    const newGroupNode: Node = {
        id: `group-${groupData.id}`,
        type: 'group',
        data: { label: groupData.name, color: groupColor },
        position: { x: groupX, y: groupY },
        style: `width: 200px; height: 200px; background-color: ${hexToRgba(groupColor, 0.2)}; border: 2px dashed ${groupColor}; z-index: -1;`,
        width: 200,
        height: 200
    };
    
    return newGroupNode;
}
