<script lang="ts">
    import CartesianGrid from '$lib/components/CartesianGrid.svelte';
    import type { Node, Edge } from '@xyflow/svelte';
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabaseClient';

    let nodes = $state<Node[]>([]);
    let edges = $state<Edge[]>([]);

    onMount(async () => {
        const { data, error } = await supabase.from('nodes').select('*');
        if (error) {
            console.error('Error fetching nodes:', error);
            return;
        }

        if (data) {
            nodes = data.map((n: any) => ({
                id: n.id,
                type: 'point',
                position: { x: n.location_x, y: n.location_y },
                data: { label: n.id }
            }));
        }
    });
</script>

<div class="h-screen flex flex-col bg-gray-50 overflow-hidden">
    <div class="flex-none p-8 pb-4">
        <div class="max-w-7xl mx-auto">
            <div class="md:flex md:items-center md:justify-between">
                <div class="min-w-0 flex-1">
                    <h2 class="text-2xl font-bold text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                        Operational Map
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
                <CartesianGrid bind:nodes bind:edges />
            </div>
        </div>
    </div>
</div>

