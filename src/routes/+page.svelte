<script lang="ts">
    import CartesianGrid from '$lib/components/CartesianGrid.svelte';
    import ControlPanel from '$lib/components/ControlPanel.svelte';
    import type { Node, Edge } from '@xyflow/svelte';
    import { onMount } from 'svelte';
    import { fetchMapData, generateRobotSteps, updateRobotPositionInDb } from '$lib/mapData';

    let edges = $state<Edge[]>([]);

    $effect(() => {
        const currentRobots = robotSteps.length > 0 
            ? robotSteps[Math.min(currentStep, robotSteps.length - 1)]
            : initialRobots;
            
        const newEdges: Edge[] = [];
        
        // Add edge from leader to target
        if (selectedLeaderId && selectedTargetNodeId) {
            const leader = currentRobots.find((r: any) => r.id === selectedLeaderId);
            const target = staticNodes.find((n: any) => n.id === selectedTargetNodeId);
            
            if (leader && target) {
                const dx = leader.position.x - target.position.x;
                const dy = leader.position.y - target.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy).toFixed(2);

                newEdges.push({
                    id: `edge-leader-${leader.id}-${target.id}`,
                    source: leader.id,
                    target: target.id,
                    label: `${distance}`,
                    type: 'straight',
                    animated: true,
                    style: `stroke: ${leader.data.color}; stroke-width: 2;`,
                });
            }
        }

        currentRobots.forEach((robot: Node) => {
            if (!robot.data.is_leader) {
                staticNodes.forEach((node: Node) => {
                    if (robot.data.color === node.data.dbColor) {
                        const dx = robot.position.x - node.position.x;
                        const dy = robot.position.y - node.position.y;
                        const distance = Math.sqrt(dx * dx + dy * dy).toFixed(2);
                        
                        newEdges.push({
                            id: `edge-${robot.id}-${node.id}`,
                            source: robot.id,
                            target: node.id,
                            label: `${distance}`,
                            type: 'straight',
                            style: 'stroke: #999; stroke-dasharray: 5 5;',
                        });
                    }
                });
            }
        });
        edges = newEdges;
    });
    
    let staticNodes = $state<Node[]>([]);
    let initialRobots = $state<Node[]>([]);
    
    let selectedLeaderId = $state<string | null>(null);
    let selectedMovingRobotId = $state<string | null>(null);
    let selectedTargetNodeId = $state<string | null>(null);
    let currentStep = $state(0);

    // Derived state for robot steps
    let robotSteps = $derived(
        initialRobots.length > 0 
            ? generateRobotSteps(initialRobots, staticNodes, selectedLeaderId, selectedTargetNodeId, selectedMovingRobotId)
            : []
    );

    // Derived state for displayed nodes
    let nodes = $derived.by(() => {
        if (robotSteps.length > 0) {
            // Ensure currentStep is valid
            const safeStep = Math.min(currentStep, robotSteps.length - 1);
            
            const robotsWithData = robotSteps[safeStep].map((robot: any) => {
                const neighbors: any[] = [];
                if (!robot.data.is_leader) {
                    staticNodes.forEach((node: Node) => {
                        if (robot.data.color === node.data.dbColor) {
                            neighbors.push({
                                id: node.id,
                                x: node.position.x,
                                y: node.position.y
                            });
                        }
                    });
                }
                return {
                    ...robot,
                    data: {
                        ...robot.data,
                        currentPosition: robot.position,
                        neighbors,
                        onDotMove: (x: number, y: number) => handleDotMove(robot.id, x, y)
                    }
                };
            });

            return [...staticNodes, ...robotsWithData];
        }
        return [...staticNodes];
    });

    onMount(async () => {
        const data = await fetchMapData();
        staticNodes = data.staticNodes;
        initialRobots = data.initialRobots;
        
        // Initialize selection based on data
        if (initialRobots.length > 0) {
            const currentLeader = initialRobots.find((r: any) => r.data.is_leader);
            if (currentLeader) {
                selectedLeaderId = currentLeader.id;
            } else {
                selectedLeaderId = initialRobots[0].id;
            }
            selectedMovingRobotId = selectedLeaderId;
        }

        if (staticNodes.length > 0) {
            selectedTargetNodeId = staticNodes[0].id;
        }
    });

    function nextStep() {
        if (currentStep < robotSteps.length - 1) {
            currentStep++;
        }
    }

    function prevStep() {
        if (currentStep > 0) {
            currentStep--;
        }
    }

    function updateRobotPosition(node: any) {
        const robotIndex = initialRobots.findIndex(r => r.id === node.id);
        if (robotIndex !== -1) {
            // Create a new object to ensure reactivity triggers
            const updatedRobots = [...initialRobots];
            updatedRobots[robotIndex] = { 
                ...updatedRobots[robotIndex], 
                position: { ...node.position } 
            };
            initialRobots = updatedRobots;
        }
    }

    function handleDotMove(robotId: string, x: number, y: number) {
        const robotIndex = initialRobots.findIndex(r => r.id === robotId);
        if (robotIndex !== -1) {
            const updatedRobots = [...initialRobots];
            updatedRobots[robotIndex] = {
                ...updatedRobots[robotIndex],
                data: {
                    ...updatedRobots[robotIndex].data,
                    dotX: x,
                    dotY: y
                }
            };
            initialRobots = updatedRobots;
        }
    }

    function handleNodeDrag(event: any) {
        // Only allow updates on the initial step (Step 0)
        if (currentStep !== 0) return;

        const payload = event.detail || event;
        const node = payload.targetNode || payload.node;
        
        if (node && node.type === 'robot') {
            updateRobotPosition(node);
        }
    }

    async function handleNodeDragStop(event: any) {
        // Only allow DB updates on the initial step (Step 0)
        if (currentStep !== 0) return;

        // Handle both CustomEvent (from on:nodedragstop) and direct callback (from onnodedragstop prop)
        const payload = event.detail || event;
        const node = payload.targetNode || payload.node;
        
        if (node && node.type === 'robot') {
            const { error } = await updateRobotPositionInDb(node);

            if (error) {
                console.error('Error updating robot position:', error);
            } else {
                // Update the initial step in our local state to match
                // This will automatically trigger the derived stores to update
                updateRobotPosition(node);
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
                <div class="mt-4 flex md:ml-4 md:mt-0 space-x-2">
                    <button 
                        onclick={prevStep}
                        disabled={currentStep === 0}
                        class="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Prev
                    </button>
                    <span class="inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-900">
                        Step {currentStep + 1} / {Math.max(1, robotSteps.length)}
                    </span>
                    <button 
                        onclick={nextStep}
                        disabled={currentStep === robotSteps.length - 1}
                        class="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Next
                    </button>
                    <a href="/decision-diagram" class="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                        Go to Decision Diagram
                    </a>
                </div>
            </div>
        </div>
    </div>

    <div class="flex-1 p-8 pt-0 min-h-0 flex gap-6">
        <div class="flex-1 h-full">
            <div class="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 h-full relative flex items-center justify-center bg-slate-100">
                <CartesianGrid 
                    bind:nodes 
                    bind:edges 
                    onNodeDragStop={handleNodeDragStop} 
                    onNodeDrag={handleNodeDrag}
                />
            </div>
        </div>
        <div class="w-80 flex-none">
            <ControlPanel 
                robots={initialRobots} 
                pointNodes={staticNodes}
                bind:selectedLeaderId 
                bind:selectedTargetNodeId 
            />
        </div>
    </div>
</div>

