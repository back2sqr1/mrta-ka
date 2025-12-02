<script lang="ts">
    import type { Node } from '@xyflow/svelte';

    let { 
        robots, 
        pointNodes, 
        selectedLeaderId = $bindable(), 
        selectedMovingRobotId = $bindable(),
        selectedTargetNodeId = $bindable() 
    } = $props<{
        robots: Node[];
        pointNodes: Node[];
        selectedLeaderId: string | null;
        selectedMovingRobotId: string | null;
        selectedTargetNodeId: string | null;
    }>();

    // Derived filtered nodes based on moving robot color
    let filteredPointNodes = $derived.by(() => {
        if (!selectedMovingRobotId) return pointNodes;
        
        const movingRobot = robots.find((r: any) => r.id === selectedMovingRobotId);
        const requiredColor = movingRobot?.data.color;
        
        if (!requiredColor) return pointNodes;

        return pointNodes.filter((node: any) => node.data.dbColor === requiredColor);
    });

    // Reset target if it's no longer valid
    $effect(() => {
        if (selectedTargetNodeId && filteredPointNodes.length > 0) {
            const isValid = filteredPointNodes.some((n: any) => n.id === selectedTargetNodeId);
            if (!isValid) {
                selectedTargetNodeId = filteredPointNodes[0].id;
            }
        } else if (filteredPointNodes.length > 0 && !selectedTargetNodeId) {
             selectedTargetNodeId = filteredPointNodes[0].id;
        }
    });
</script>

<div class="bg-white p-6 rounded-lg shadow-lg border border-gray-200 h-full">
    <h3 class="text-lg font-medium leading-6 text-gray-900 mb-4">Mission Plan</h3>
    
    <div class="space-y-6">
        <div>
            <label for="leader-select" class="block text-sm font-medium leading-6 text-gray-900">
                Select Leader Robot
            </label>
            <div class="mt-2">
                <select
                    id="leader-select"
                    bind:value={selectedLeaderId}
                    class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                >
                    <option value={null}>-- Select Leader --</option>
                    {#each robots as robot}
                        <option value={robot.id}>
                            {robot.data.label}
                        </option>
                    {/each}
                </select>
            </div>
            <p class="mt-2 text-sm text-gray-500">
                The selected robot will be marked as the leader (with a crown).
            </p>
        </div>

        <div>
            <label for="moving-select" class="block text-sm font-medium leading-6 text-gray-900">
                Select Robot to Move
            </label>
            <div class="mt-2">
                <select
                    id="moving-select"
                    bind:value={selectedMovingRobotId}
                    class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                >
                    <option value={null}>-- Select Robot --</option>
                    {#each robots as robot}
                        <option value={robot.id}>
                            {robot.data.label} {robot.id === selectedLeaderId ? '(Leader)' : '(Follower)'}
                        </option>
                    {/each}
                </select>
            </div>
            <p class="mt-2 text-sm text-gray-500">
                Select which robot will move in the next step.
            </p>
        </div>

        <div>
            <label for="target-select" class="block text-sm font-medium leading-6 text-gray-900">
                Select Target Destination
            </label>
            <div class="mt-2">
                <select
                    id="target-select"
                    bind:value={selectedTargetNodeId}
                    class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                >
                    <option value={null}>-- Select Target --</option>
                    {#each filteredPointNodes as node}
                        <option value={node.id}>
                            Node {node.data.label} ({node.data.dbColor})
                        </option>
                    {/each}
                </select>
            </div>
            <p class="mt-2 text-sm text-gray-500">
                {#if selectedMovingRobotId}
                    {@const movingRobot = robots.find((r: any) => r.id === selectedMovingRobotId)}
                    {movingRobot?.data.label} ({movingRobot?.data.color}) can only move to {movingRobot?.data.color} nodes.
                {:else}
                    Select a robot to see valid destinations.
                {/if}
            </p>
        </div>
    </div>
</div>
