import type { Node, Edge } from '@xyflow/svelte';
import type { SupabaseClient } from '@supabase/supabase-js';

export const uiColorToDb = (hex: string) => (hex === '#fecaca' ? 'red' : 'green');
export const dbColorToUi = (color: string) => (color === 'red' ? '#fecaca' : '#bbf7d0');

export const getMexId = (currentNodes: Node[]) => {
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

export const getMexEdgeId = (currentEdges: Edge[]) => {
  const existingIds = new Set(currentEdges.map((e) => parseInt(e.id)).filter(n => !isNaN(n)));
  let i = 1;
  while (true) {
    if (!existingIds.has(i)) {
      return String(i);
    }
    i++;
  }
};

export async function saveFlowToSupabase(
    supabase: SupabaseClient,
    nodes: Node[],
    edges: Edge[]
) {
    // 1. Upsert Nodes
    // Filter out group nodes (which we generate dynamically) and convert relative positions back to absolute
    const dbNodes = nodes
        .filter((n) => n.type !== 'group')
        .map((n) => {
            let x = n.position.x;
            let y = n.position.y;
            let group_x = null;
            let group_y = null;

            // If node has a parent, add parent's position to get absolute coordinates
            if (n.parentId) {
                // Save local coordinates for group_x/y
                group_x = n.position.x;
                group_y = n.position.y;

                const parent = nodes.find((p) => p.id === n.parentId);
                if (parent) {
                    x += parent.position.x;
                    y += parent.position.y;
                }
            }

            return {
                id: n.id,
                color: uiColorToDb(n.data.color as string),
                location_x: x,
                location_y: y,
                decision_x: n.data.x_coord,
                decision_y: n.data.y_coord,
                group_x: group_x,
                group_y: group_y,
            };
        });

    const { error: upsertError } = await supabase.from('nodes').upsert(dbNodes);
    if (upsertError) console.error('Error upserting nodes:', upsertError);

    // 1.5 Upsert Groups (Save positions)
    const groupNodes = nodes.filter(n => n.type === 'group');
    if (groupNodes.length > 0) {
        const dbGroups = groupNodes.map(g => {
            // Try to get width/height from node properties or style
            let width = g.width ?? g.measured?.width;
            let height = g.height ?? g.measured?.height;

            if (!width || !height) {
                 const styleWidth = /width:\s*([\d.]+)px/.exec(g.style || '');
                 const styleHeight = /height:\s*([\d.]+)px/.exec(g.style || '');
                 if (styleWidth) width = parseFloat(styleWidth[1]);
                 if (styleHeight) height = parseFloat(styleHeight[1]);
            }

            return {
                id: parseInt(g.id.replace('group-', '')),
                name: g.data.label, // Ensure name is preserved/updated
                position_x: g.position.x,
                position_y: g.position.y,
                box_width: width,
                box_height: height
            };
        });
        
        const { error: groupError } = await supabase.from('node_groups').upsert(dbGroups);
        if (groupError) console.error('Error upserting groups:', groupError);
    }

    // 2. Delete obsolete nodes
    const currentIds = nodes.filter(n => n.type !== 'group').map((n) => n.id);
    const { data: allDbNodes } = await supabase.from('nodes').select('id');
    if (allDbNodes) {
      const toDelete = allDbNodes
        .map((n: any) => n.id)
        .filter((id: string) => !currentIds.includes(id));

      if (toDelete.length > 0) {
        // Explicitly delete from node_group_members first
        const { error: deleteMembersError } = await supabase
            .from('node_group_members')
            .delete()
            .in('node_id', toDelete);
        if (deleteMembersError) console.error('Error deleting obsolete node group members:', deleteMembersError);

        const { error: deleteError } = await supabase
          .from('nodes')
          .delete()
          .in('id', toDelete);
        if (deleteError) console.error('Error deleting nodes:', deleteError);
      }
    }

    // 3. Replace Edges
    const { error: deleteEdgesError } = await supabase
      .from('edges')
      .delete()
      .gt('id', 0);
    if (deleteEdgesError)
      console.error('Error deleting edges:', deleteEdgesError);

    // Calculate valid IDs first
    const validIds = new Set<number>();
    edges.forEach(e => {
        const pid = parseInt(e.id);
        if (!isNaN(pid)) validIds.add(pid);
    });

    // Helper to get next ID
    let nextId = 1;
    const getNextId = () => {
        while (validIds.has(nextId)) nextId++;
        validIds.add(nextId);
        return nextId;
    };

    const dbEdges = edges.map((e) => {
        let pid = parseInt(e.id);
        if (isNaN(pid)) {
            pid = getNextId();
        }
        return {
            id: pid,
            source_node_id: e.source,
            target_node_id: e.target,
        };
    });

    if (dbEdges.length > 0) {
      const { error: insertEdgesError } = await supabase
        .from('edges')
        .insert(dbEdges);
      if (insertEdgesError)
        console.error('Error inserting edges:', insertEdgesError);
    }

    // 4. Update Node Group Memberships
    const nodeIds = nodes.map(n => n.id);
    if (nodeIds.length > 0) {
        // Delete existing memberships for the current nodes
        const { error: deleteMembersError } = await supabase
            .from('node_group_members')
            .delete()
            .in('node_id', nodeIds);
        
        if (deleteMembersError) console.error('Error deleting node group members:', deleteMembersError);

        // Insert new memberships
        const groupMembers = nodes
            .filter(n => n.data.node_group_id)
            .map(n => ({
                node_id: n.id,
                node_group_id: n.data.node_group_id
            }));
        
        if (groupMembers.length > 0) {
            const { error: insertMembersError } = await supabase
                .from('node_group_members')
                .insert(groupMembers);
            
            if (insertMembersError) console.error('Error inserting node group members:', insertMembersError);
        }
    }
}