<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';

  let { data } = $props<NodeProps>();
</script>

<div class="flex items-center justify-center relative">
  {#if data.radius}
    <div 
      class="absolute rounded-full border-2 border-dashed border-blue-400 bg-blue-100/20 pointer-events-none"
      style:width="{data.radius * 2}px"
      style:height="{data.radius * 2}px"
      style:left="50%"
      style:top="50%"
      style:transform="translate(-50%, -50%)"
    ></div>
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
  </div>
  <Handle type="source" position={Position.Right} class="!bg-transparent !w-full !h-full !border-none !top-0 !left-0 !transform-none !rounded-full opacity-0" />
  <Handle type="target" position={Position.Left} class="!bg-transparent !w-full !h-full !border-none !top-0 !left-0 !transform-none !rounded-full opacity-0" />
</div>
