import { supabase } from '$lib/supabaseClient';
import { dbColorToUi } from '$lib/utils';
import type { Node } from '@xyflow/svelte';

export async function fetchMapData() {
    const { data: nodesData, error: nodesError } = await supabase.from('nodes').select('*');
    if (nodesError) {
        console.error('Error fetching nodes:', nodesError);
    }

    const { data: robotsData, error: robotsError } = await supabase.from('robots').select('*');
    if (robotsError) {
        console.error('Error fetching robots:', robotsError);
    }

    let staticNodes: Node[] = [];
    if (nodesData) {
        staticNodes = nodesData.map((n: any) => ({
            id: String(n.id),
            type: 'point',
            position: { x: n.location_x, y: n.location_y },
            data: { label: n.id, color: dbColorToUi(n.color), dbColor: n.color },
            draggable: false
        }));
    }

    let initialRobots: Node[] = [];
    if (robotsData) {
        initialRobots = robotsData.map((r: any, index: number) => ({
            id: `robot-${r.id}`,
            type: 'robot',
            position: { x: r.position_x, y: r.position_y },
            data: { 
                label: `R${r.id}`, 
                is_leader: r.is_leader,
                color: index === 0 ? 'red' : 'green' // R1 is Red, others are Green
            },
            draggable: true
        }));
    }

    return { staticNodes, initialRobots };
}

export function generateRobotSteps(
    initialRobots: Node[], 
    staticNodes: Node[], 
    leaderId: string | null = null, 
    targetNodeId: string | null = null,
    movingRobotId: string | null = null
): Node[][] {
    let newRobotSteps: Node[][] = [];
    
    // Determine Leader Index
    let leaderIndex = -1;
    if (leaderId) {
        leaderIndex = initialRobots.findIndex((r: any) => r.id === leaderId);
    } else {
        leaderIndex = initialRobots.findIndex((r: any) => r.data.is_leader);
        if (leaderIndex === -1 && initialRobots.length > 0) leaderIndex = 0;
    }

    // Determine Moving Robot Index
    let movingRobotIndex = -1;
    if (movingRobotId) {
        movingRobotIndex = initialRobots.findIndex((r: any) => r.id === movingRobotId);
    } else if (leaderIndex !== -1) {
        // Default to leader if no moving robot specified
        movingRobotIndex = leaderIndex;
    }

    // Find the target position
    let targetPosition = null;
    if (targetNodeId && staticNodes.length > 0) {
        const targetNode = staticNodes.find(n => n.id === targetNodeId);
        if (targetNode) {
            targetPosition = targetNode.position;
        }
    } else if (staticNodes.length > 0) {
        // Default to first node
        targetPosition = staticNodes[0].position;
    }

    // Calculate move distance (Only if Leader is moving)
    let moveDistance = 0;
    if (movingRobotIndex !== -1 && movingRobotIndex === leaderIndex && targetPosition) {
        const currentPos = initialRobots[movingRobotIndex].position;
        const dx = targetPosition.x - currentPos.x;
        const dy = targetPosition.y - currentPos.y;
        moveDistance = Math.sqrt(dx * dx + dy * dy);
    }

    // Step 0: Initial positions
    // We need to update the is_leader status in the initial step based on the selected leaderId
    // IMPORTANT: We must deep copy the position object to avoid sharing references with initialRobots.
    // If we share references, SvelteFlow updating the node position will mutate initialRobots,
    // triggering the $effect in +page.svelte and causing an infinite loop.
    const step0Robots = initialRobots.map((r, index) => {
        const isLeader = (leaderIndex !== -1 && index === leaderIndex);
        const isFollower = !isLeader; 
        
        // Apply radius to followers if distance is calculated (Leader is moving)
        const radius = (isFollower && moveDistance > 0) ? moveDistance : undefined;

        return {
            ...r,
            position: { ...r.position },
            data: {
                ...r.data,
                is_leader: isLeader,
                radius: radius
            }
        };
    });
    newRobotSteps.push(step0Robots);

    // Step 1: Moving Robot moves to the target point node
    if (initialRobots.length > 0) {
        const step1Robots = JSON.parse(JSON.stringify(step0Robots));
        
        if (movingRobotIndex !== -1 && targetPosition) {
            step1Robots[movingRobotIndex].position = { ...targetPosition };
        }
        
        newRobotSteps.push(step1Robots);
    }

    return newRobotSteps;
}

export async function updateRobotPositionInDb(node: Node) {
    if (node.type !== 'robot') return { error: null };

    const id = parseInt(node.id.replace('robot-', ''), 10);
    
    const { error } = await supabase.from('robots').update({
        position_x: node.position.x,
        position_y: node.position.y
    }).eq('id', id);

    return { error };
}
