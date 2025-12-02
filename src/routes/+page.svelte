<script lang="ts">
    import CartesianGrid from '$lib/components/CartesianGrid.svelte';
    import type { Node, Edge } from '@xyflow/svelte';
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabaseClient';
    import { dbColorToUi } from '$lib/utils';

    let nodes = $state<Node[]>([]);
    let edges = $state<Edge[]>([]);

    onMount(async () => {
        const { data: nodesData, error: nodesError } = await supabase.from('nodes').select('*');
        if (nodesError) {
            console.error('Error fetching nodes:', nodesError);
        }

        const { data: robotsData, error: robotsError } = await supabase.from('robots').select('*');
        if (robotsError) {
            console.error('Error fetching robots:', robotsError);
        }

        let newNodes: Node[] = [];

        if (nodesData) {
            newNodes = [
                ...newNodes,
                ...nodesData.map((n: any) => ({
                    id: String(n.id),
                    type: 'point',
                    position: { x: n.location_x, y: n.location_y },
                    data: { label: n.id, color: dbColorToUi(n.color) },
                    draggable: false
                }))
            ];
        }

        if (robotsData) {
            newNodes = [
                ...newNodes,
                ...robotsData.map((r: any) => ({
                    id: `robot-${r.id}`,
                    type: 'robot',
                    position: { x: r.position_x, y: r.position_y },
                    data: { label: `R${r.id}`, is_leader: r.is_leader },
                    draggable: true
                }))
            ];
        }

        nodes = newNodes;
    });

    async function handleNodeDragStop(event: any) {
        // Handle both CustomEvent (from on:nodedragstop) and direct callback (from onnodedragstop prop)
        const payload = event.detail || event;
        const node = payload.targetNode || payload.node;
        
        if (node && node.type === 'robot') {
            const id = parseInt(node.id.replace('robot-', ''), 10);
            
            const { error } = await supabase.from('robots').update({
                position_x: node.position.x,
                position_y: node.position.y
            }).eq('id', id);

            if (error) {
                console.error('Error updating robot position:', error);
            }
        }
    }
</script>

<div class="h-screen flex flex-col bg-gray-50 overflow-hidden">
    <div class="flex-none p-8 pb-4">
        <div class="max-w-7xl mx-auto">
            <div class="md:flex md:items-center md:justify-between">
                <div class="min-w-0 flex-1">
                    <h2 class="text-2xl font-bold text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                        Location Map
                    </h2>
                </div>
                <div class="mt-4 flex md:ml-4 md:mt-0">
                    <a href="/decision-diagram" class="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                        Go to Decision Diagram
                    </a>
                </div>
            </div>
        </div>
    </div>

    <div class="flex-1 p-8 pt-0 min-h-0">
        <div class="max-w-7xl mx-auto h-full">
            <div class="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 h-full relative flex items-center justify-center bg-slate-100">
                <CartesianGrid bind:nodes bind:edges onNodeDragStop={handleNodeDragStop} />
            </div>
        </div>
    </div>
</div>

