<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';

  let { data } = $props<NodeProps>();
  
  // Dot position relative to center (can be anywhere within radius)
  let dotX = $state(data.dotX ?? data.radius ?? 0);
  let dotY = $state(data.dotY ?? 0);
  let isDragging = $state(false);
  let containerRef: HTMLElement | null = $state(null);
  
  function handleMouseDown(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    isDragging = true;
    
    // Store reference to the container at drag start
    const target = e.currentTarget as HTMLElement;
    containerRef = target.closest('.robot-node-container') as HTMLElement;
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }
  
  function handleMouseMove(e: MouseEvent) {
    if (!isDragging || !data.radius || !containerRef) return;
    
    e.preventDefault();
    
    // Get the robot node center position from stored container
    const rect = containerRef.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate zoom scale based on rendered size vs layout size
    const zoom = containerRef.offsetWidth > 0 ? rect.width / containerRef.offsetWidth : 1;
    
    // Calculate position from center to mouse, adjusting for zoom
    let dx = (e.clientX - centerX) / zoom;
    let dy = (e.clientY - centerY) / zoom;
    
    // Constrain to be within radius (not exceeding it)
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > data.radius) {
      // Clamp to the circle edge
      const scale = data.radius / distance;
      dx *= scale;
      dy *= scale;
    }
    
    dotX = dx;
    dotY = dy;
    
    // Update data if callback exists
    if (data.onDotMove) {
      data.onDotMove(dotX, dotY);
    }
  }
  
  function handleMouseUp() {
    isDragging = false;
    containerRef = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }

  let lines = $derived.by(() => {
      if (!data.neighbors || !data.currentPosition) return [];
      
      return data.neighbors.map((neighbor: any) => {
          const relX = (neighbor.x - data.currentPosition.x);
          const relY = (neighbor.y - data.currentPosition.y);
          
          // Distance from robot center to neighbor
          const distRobot = Math.sqrt(relX * relX + relY * relY);
          
          // Distance from dot to neighbor
          const dx = relX - dotX;
          const dy = relY - dotY;
          const distDot = Math.sqrt(dx * dx + dy * dy);
          
          // Color interpolation: Green (closer) -> Red (further)
          const diff = distDot - distRobot;
          const maxDiff = data.radius || 50;
          let t = (diff + maxDiff) / (2 * maxDiff);
          t = Math.max(0, Math.min(1, t));
          
          const r = Math.round(255 * t);
          const g = Math.round(255 * (1 - t));
          const color = `rgb(${r}, ${g}, 0)`;
          
          return {
              id: neighbor.id,
              x1: dotX,
              y1: dotY,
              x2: relX,
              y2: relY,
              color,
              distDot,
              distRobot,
              distDotStr: distDot.toFixed(2)
          };
      });
  });

  let maxDotDist = $derived.by(() => {
      if (lines.length === 0) return "0.00";
      return Math.max(...lines.map(l => l.distDot)).toFixed(2);
  });

  let maxRobotDist = $derived.by(() => {
      if (lines.length === 0) return "0.00";
      return Math.max(...lines.map(l => l.distRobot)).toFixed(2);
  });
</script>

<div class="robot-node-container flex items-center justify-center relative">
  <!-- Lines to neighbors -->
  <svg class="absolute overflow-visible pointer-events-none z-0" style="left: 50%; top: 50%; width: 0; height: 0;">
    {#each lines as line}
        <line 
            x1={line.x1} 
            y1={line.y1} 
            x2={line.x2} 
            y2={line.y2} 
            stroke={line.color} 
            stroke-width="2" 
            stroke-dasharray="5 5"
        />
        <!-- Distance on the line -->
        <text 
            x={(line.x1 + line.x2) / 2} 
            y={(line.y1 + line.y2) / 2} 
            fill="black" 
            font-size="10" 
            text-anchor="middle"
            stroke="white" 
            stroke-width="3" 
            paint-order="stroke"
        >
            {line.distDotStr}
        </text>
    {/each}
  </svg>

  {#if data.radius}
    <!-- Circle around robot -->
    <div 
      class="absolute rounded-full border-2 border-dashed border-blue-400 bg-blue-100/20 pointer-events-none"
      style:width="{data.radius * 2}px"
      style:height="{data.radius * 2}px"
      style:left="50%"
      style:top="50%"
      style:transform="translate(-50%, -50%)"
    ></div>

    <!-- Draggable dot constrained to circle edge -->
    <div
      class="absolute bg-blue-500 rounded-full cursor-grab z-20 flex items-center justify-center"
      class:cursor-grabbing={isDragging}
      style:width="10px"
      style:height="10px"
      style:left="calc(50% + {dotX}px)"
      style:top="calc(50% + {dotY}px)"
      style:transform="translate(-50%, -50%)"
      onmousedown={handleMouseDown}
      role="button"
      aria-label="Drag to set direction"
      tabindex="0"
    >
        <!-- Display max distance on dot if only one neighbor, or just the first one -->
        {#if lines.length > 0}
            <div class="absolute -top-5 bg-white px-1 rounded text-[10px] whitespace-nowrap border border-gray-300 shadow-sm">
                Max: {maxDotDist}
            </div>
        {/if}
    </div>
  {/if}
  {#if data.is_leader}
    <div class="absolute -top-6 left-1/2 -translate-x-1/2 z-20 drop-shadow-md">
      <img src="/crown-icon.svg" alt="Leader Crown" class="w-8 h-8" />
    </div>
  {/if}
  <div 
    class="flex h-8 w-8 items-center justify-center rounded-md border-2 border-gray-900 text-sm font-bold text-white shadow-sm relative z-10"
    style:background-color={data.color}
  >
    {data.label}
    <!-- Display robot distance if lines exist -->
    {#if lines.length > 0}
        <div class="absolute -bottom-5 bg-white text-black px-1 rounded text-[10px] whitespace-nowrap border border-gray-300 shadow-sm">
            Max: {maxRobotDist}
        </div>
    {/if}
  </div>
  <Handle type="source" position={Position.Top} style="top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0;" />
  <Handle type="target" position={Position.Top} style="top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0;" />
</div>